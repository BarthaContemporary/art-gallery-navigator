
interface ClientsEmptyStateProps {
  searchTerm: string;
  statusFilter: string;
}

export function ClientsEmptyState({ searchTerm, statusFilter }: ClientsEmptyStateProps) {
  return (
    <div className="text-center p-8">
      <p className="text-muted-foreground mb-4">
        {searchTerm || statusFilter !== 'all'
          ? "No clients match your search criteria"
          : "No clients found"
        }
      </p>
      {!searchTerm && statusFilter === 'all' && (
        <p className="text-sm text-muted-foreground">
          Create your first client to get started
        </p>
      )}
    </div>
  );
}
