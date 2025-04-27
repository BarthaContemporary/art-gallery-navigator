
export interface UploadData {
  id: string;
  file_name: string;
  file_url: string;
  file_size?: number;
  created_at: string;
  uploaded_by: string;
  notes?: string;
}

export interface ProfileData {
  id: string;
  display_name: string | null;
}
