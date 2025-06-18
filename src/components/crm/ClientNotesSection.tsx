
interface ClientNotesSectionProps {
  client: any;
}

export function ClientNotesSection({ client }: ClientNotesSectionProps) {
  if (!client.notes) return null;

  return (
    <div className="pt-4 border-t">
      <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-2">
        Notes
      </h3>
      <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
        {client.notes}
      </p>
    </div>
  );
}
