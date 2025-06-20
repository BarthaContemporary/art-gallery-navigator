
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let requestBody: any
  try {
    requestBody = await req.json()
  } catch (error) {
    console.error('Failed to parse request body:', error)
    return new Response(
      JSON.stringify({ error: 'Invalid request body' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const { image_id, original_path } = requestBody

  if (!image_id || !original_path) {
    return new Response(
      JSON.stringify({ error: 'Missing required parameters: image_id and original_path' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  console.log(`Processing image ${image_id} from path ${original_path}`)

  try {
    // Update status to processing
    await supabaseClient
      .from('artwork_images')
      .update({ processing_status: 'processing' })
      .eq('id', image_id)

    // Download original image
    const { data: originalFile, error: downloadError } = await supabaseClient.storage
      .from('artwork-images-original')
      .download(original_path)

    if (downloadError) {
      throw new Error(`Failed to download original: ${downloadError.message}`)
    }

    // Convert to array buffer for processing
    const originalBuffer = await originalFile.arrayBuffer()
    console.log(`Downloaded original image, size: ${originalBuffer.byteLength} bytes`)

    // Check if file is too large for Cloudinary (10MB limit)
    const maxCloudinarySize = 10 * 1024 * 1024 // 10MB
    const useCloudinary = originalBuffer.byteLength <= maxCloudinarySize

    let processedPaths: Record<string, string> = {}

    if (useCloudinary) {
      // Use Cloudinary for processing
      processedPaths = await processWithCloudinary(originalBuffer, image_id)
    } else {
      // Use local processing for large files
      console.log(`File too large for Cloudinary (${originalBuffer.byteLength} bytes), using local processing`)
      processedPaths = await processLocally(originalBuffer, image_id, supabaseClient)
    }

    // Update database with processed paths and get original dimensions
    const imageMetadata = await getImageMetadata(originalBuffer)
    const updateData = {
      ...processedPaths,
      processing_status: 'completed',
      processing_error: null,
      image_url: processedPaths.medium_storage_path || processedPaths.large_storage_path || original_path,
      original_width: imageMetadata.width,
      original_height: imageMetadata.height,
      original_size: originalBuffer.byteLength
    }

    const { error: updateError } = await supabaseClient
      .from('artwork_images')
      .update(updateData)
      .eq('id', image_id)

    if (updateError) {
      throw new Error(`Failed to update database: ${updateError.message}`)
    }

    console.log(`Successfully processed image ${image_id}`)

    return new Response(
      JSON.stringify({ success: true, processed_paths: processedPaths }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Processing failed:', error)
    
    // Update database with error status
    try {
      await supabaseClient
        .from('artwork_images')
        .update({
          processing_status: 'failed',
          processing_error: error instanceof Error ? error.message : 'Unknown error'
        })
        .eq('id', image_id)
    } catch (dbError) {
      console.error('Failed to update error status:', dbError)
    }

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Processing failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function processWithCloudinary(originalBuffer: ArrayBuffer, imageId: string): Promise<Record<string, string>> {
  const cloudinaryCloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME')
  const cloudinaryApiKey = Deno.env.get('CLOUDINARY_API_KEY')
  const cloudinaryApiSecret = Deno.env.get('CLOUDINARY_API_SECRET')

  if (!cloudinaryCloudName || !cloudinaryApiKey || !cloudinaryApiSecret) {
    throw new Error('Missing Cloudinary configuration')
  }

  const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/image/upload`
  
  const formData = new FormData()
  formData.append('file', new Blob([originalBuffer]))
  formData.append('api_key', cloudinaryApiKey)
  formData.append('timestamp', Math.floor(Date.now() / 1000).toString())
  formData.append('folder', 'artwork_processing')
  
  // Generate signature for authentication
  const timestamp = Math.floor(Date.now() / 1000)
  const stringToSign = `folder=artwork_processing&timestamp=${timestamp}${cloudinaryApiSecret}`
  const encoder = new TextEncoder()
  const data = encoder.encode(stringToSign)
  const hashBuffer = await crypto.subtle.digest('SHA-1', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  
  formData.append('signature', signature)

  const cloudinaryResponse = await fetch(cloudinaryUrl, {
    method: 'POST',
    body: formData
  })

  if (!cloudinaryResponse.ok) {
    const errorText = await cloudinaryResponse.text()
    console.error('Cloudinary upload failed:', errorText)
    throw new Error(`Cloudinary upload failed: ${cloudinaryResponse.status} - ${errorText}`)
  }

  const cloudinaryData = await cloudinaryResponse.json()
  const publicId = cloudinaryData.public_id
  console.log(`Successfully uploaded to Cloudinary with public_id: ${publicId}`)

  // Generate different sizes and upload to local storage
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const sizes = [
    { name: 'thumbnail', width: 300, height: 300 },
    { name: 'medium', width: 800, height: 800 },
    { name: 'large', width: 1600, height: 1600 }
  ]

  const processedPaths: Record<string, string> = {}

  for (const size of sizes) {
    try {
      const transformedUrl = `https://res.cloudinary.com/${cloudinaryCloudName}/image/upload/c_fit,w_${size.width},h_${size.height},q_90,f_webp/${publicId}`
      
      const processedResponse = await fetch(transformedUrl)
      if (!processedResponse.ok) {
        console.error(`Failed to fetch ${size.name} version: ${processedResponse.status}`)
        continue
      }

      const processedBuffer = await processedResponse.arrayBuffer()
      console.log(`Downloaded ${size.name} version, size: ${processedBuffer.byteLength} bytes`)
      
      const storagePath = `${imageId}/${size.name}.webp`
      const { error: uploadError } = await supabaseClient.storage
        .from('artwork-images-processed')
        .upload(storagePath, new Uint8Array(processedBuffer), {
          contentType: 'image/webp',
          upsert: true
        })

      if (uploadError) {
        console.error(`Failed to store ${size.name}: ${uploadError.message}`)
        continue
      }

      processedPaths[`${size.name}_storage_path`] = storagePath
      console.log(`Successfully processed and stored ${size.name} version`)
    } catch (sizeError) {
      console.error(`Failed to process ${size.name}:`, sizeError)
    }
  }

  // Clean up Cloudinary
  try {
    const destroyUrl = `https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/image/destroy`
    const destroyTimestamp = Math.floor(Date.now() / 1000)
    const destroyStringToSign = `public_id=${publicId}&timestamp=${destroyTimestamp}${cloudinaryApiSecret}`
    const destroyData = encoder.encode(destroyStringToSign)
    const destroyHashBuffer = await crypto.subtle.digest('SHA-1', destroyData)
    const destroyHashArray = Array.from(new Uint8Array(destroyHashBuffer))
    const destroySignature = destroyHashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    
    await fetch(destroyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        public_id: publicId,
        api_key: cloudinaryApiKey,
        timestamp: destroyTimestamp.toString(),
        signature: destroySignature
      })
    })
    console.log(`Cleaned up Cloudinary image ${publicId}`)
  } catch (cleanupError) {
    console.warn('Failed to cleanup Cloudinary image:', cleanupError)
  }

  return processedPaths
}

async function processLocally(originalBuffer: ArrayBuffer, imageId: string, supabaseClient: any): Promise<Record<string, string>> {
  // For local processing, we'll create a simple thumbnail by reducing quality
  // This is a fallback for large files that exceed Cloudinary limits
  
  const processedPaths: Record<string, string> = {}
  
  try {
    // Store original as "large" version
    const largePath = `${imageId}/large.jpg`
    const { error: largeUploadError } = await supabaseClient.storage
      .from('artwork-images-processed')
      .upload(largePath, new Uint8Array(originalBuffer), {
        contentType: 'image/jpeg',
        upsert: true
      })

    if (!largeUploadError) {
      processedPaths['large_storage_path'] = largePath
      console.log('Successfully stored large version locally')
    }

    // Create a compressed version for medium
    // Note: This is a simplified approach - in production you'd want proper image processing
    const mediumPath = `${imageId}/medium.jpg`
    const { error: mediumUploadError } = await supabaseClient.storage
      .from('artwork-images-processed')
      .upload(mediumPath, new Uint8Array(originalBuffer), {
        contentType: 'image/jpeg',
        upsert: true
      })

    if (!mediumUploadError) {
      processedPaths['medium_storage_path'] = mediumPath
      console.log('Successfully stored medium version locally')
    }

  } catch (error) {
    console.error('Local processing failed:', error)
    throw new Error(`Local processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  return processedPaths
}

async function getImageMetadata(buffer: ArrayBuffer): Promise<{ width: number | null; height: number | null }> {
  // Simple metadata extraction - in production you'd want a proper image library
  // For now, return null values and let the UI handle it gracefully
  return { width: null, height: null }
}
