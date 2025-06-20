
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

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { image_id, original_path } = await req.json()

    if (!image_id || !original_path) {
      throw new Error('Missing required parameters')
    }

    console.log(`Processing image ${image_id} from path ${original_path}`)

    // Download original image
    const { data: originalFile, error: downloadError } = await supabaseClient.storage
      .from('artwork-images-original')
      .download(original_path)

    if (downloadError) {
      throw new Error(`Failed to download original: ${downloadError.message}`)
    }

    // Convert to array buffer for processing
    const originalBuffer = await originalFile.arrayBuffer()
    
    // Process with Cloudinary
    const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${Deno.env.get('CLOUDINARY_CLOUD_NAME')}/image/upload`
    
    // Create form data for Cloudinary upload
    const formData = new FormData()
    formData.append('file', new Blob([originalBuffer]))
    formData.append('upload_preset', 'artwork_processing') // You'll need to create this preset
    formData.append('api_key', Deno.env.get('CLOUDINARY_API_KEY') ?? '')
    
    // Upload to Cloudinary for processing
    const cloudinaryResponse = await fetch(cloudinaryUrl, {
      method: 'POST',
      body: formData
    })

    if (!cloudinaryResponse.ok) {
      throw new Error('Cloudinary upload failed')
    }

    const cloudinaryData = await cloudinaryResponse.json()
    const publicId = cloudinaryData.public_id

    // Generate different sizes
    const sizes = [
      { name: 'thumbnail', width: 300, height: 300 },
      { name: 'medium', width: 800, height: 800 },
      { name: 'large', width: 1600, height: 1600 }
    ]

    const processedPaths: Record<string, string> = {}

    for (const size of sizes) {
      try {
        // Generate transformed URL
        const transformedUrl = `https://res.cloudinary.com/${Deno.env.get('CLOUDINARY_CLOUD_NAME')}/image/upload/c_fit,w_${size.width},h_${size.height},q_90,f_webp/${publicId}`
        
        // Download processed image
        const processedResponse = await fetch(transformedUrl)
        if (!processedResponse.ok) {
          throw new Error(`Failed to fetch ${size.name} version`)
        }

        const processedBuffer = await processedResponse.arrayBuffer()
        
        // Upload to local storage
        const storagePath = `${image_id}/${size.name}.webp`
        const { error: uploadError } = await supabaseClient.storage
          .from('artwork-images-processed')
          .upload(storagePath, new Uint8Array(processedBuffer), {
            contentType: 'image/webp'
          })

        if (uploadError) {
          throw new Error(`Failed to store ${size.name}: ${uploadError.message}`)
        }

        processedPaths[`${size.name}_storage_path`] = storagePath
        console.log(`Successfully processed and stored ${size.name} version`)
      } catch (sizeError) {
        console.error(`Failed to process ${size.name}:`, sizeError)
        // Continue with other sizes even if one fails
      }
    }

    // Update database with processed paths
    const updateData = {
      ...processedPaths,
      processing_status: 'completed',
      processing_error: null,
      image_url: processedPaths.medium_storage_path || processedPaths.large_storage_path || original_path
    }

    const { error: updateError } = await supabaseClient
      .from('artwork_images')
      .update(updateData)
      .eq('id', image_id)

    if (updateError) {
      throw new Error(`Failed to update database: ${updateError.message}`)
    }

    // Clean up Cloudinary (optional, to save storage)
    try {
      await fetch(`https://api.cloudinary.com/v1_1/${Deno.env.get('CLOUDINARY_CLOUD_NAME')}/image/destroy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          public_id: publicId,
          api_key: Deno.env.get('CLOUDINARY_API_KEY'),
          api_secret: Deno.env.get('CLOUDINARY_API_SECRET')
        })
      })
    } catch (cleanupError) {
      console.warn('Failed to cleanup Cloudinary image:', cleanupError)
      // Not critical, continue
    }

    console.log(`Successfully processed image ${image_id}`)

    return new Response(
      JSON.stringify({ success: true, processed_paths: processedPaths }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Processing failed:', error)
    
    // Update database with error status if we have image_id
    try {
      const { image_id } = await req.json()
      if (image_id) {
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )
        
        await supabaseClient
          .from('artwork_images')
          .update({
            processing_status: 'failed',
            processing_error: error.message
          })
          .eq('id', image_id)
      }
    } catch (dbError) {
      console.error('Failed to update error status:', dbError)
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
