
import { CreateLocationDialog } from "./CreateLocationDialog";

export const LocationHeader = () => {
  return (
    <div className="flex items-center justify-between mb-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Locations</h1>
        <p className="text-muted-foreground">
          Manage artwork storage and exhibition spaces
        </p>
      </div>
      <CreateLocationDialog />
    </div>
  );
};
