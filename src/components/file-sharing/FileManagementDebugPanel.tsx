
interface FileManagementDebugPanelProps {
  foldersCount: number;
  currentUserArtist: { full_name: string } | null;
  isAdmin: boolean;
  currentFolderName: string | null;
  foldersError: { message: string } | null;
}

export function FileManagementDebugPanel({
  foldersCount,
  currentUserArtist,
  isAdmin,
  currentFolderName,
  foldersError
}: FileManagementDebugPanelProps) {
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="mb-4 p-3 bg-gray-100 rounded text-sm">
      <p><strong>Debug Info:</strong></p>
      <p>Folders count: {foldersCount}</p>
      <p>Current user artist: {currentUserArtist?.full_name || 'None'}</p>
      <p>Is admin: {isAdmin ? 'Yes' : 'No'}</p>
      <p>Current folder: {currentFolderName || 'Root'}</p>
      {foldersError && <p className="text-red-600">Error: {foldersError.message}</p>}
    </div>
  );
}
