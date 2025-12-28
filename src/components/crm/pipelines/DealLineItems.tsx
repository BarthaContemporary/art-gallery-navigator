import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, Save, X } from "lucide-react";
import { 
  useCRMDealItems, 
  useCreateCRMDealItem, 
  useUpdateCRMDealItem, 
  useDeleteCRMDealItem,
  CRMDealItem,
  calculateLineTotal,
  calculateDealTotal 
} from "@/hooks/crm/use-crm-deal-items";

interface DealLineItemsProps {
  dealId: string;
  currency: string;
}

export function DealLineItems({ dealId, currency }: DealLineItemsProps) {
  const { data: items = [], isLoading } = useCRMDealItems(dealId);
  const createItem = useCreateCRMDealItem();
  const updateItem = useUpdateCRMDealItem();
  const deleteItem = useDeleteCRMDealItem();

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    description: "",
    quantity: "1",
    unit_price: "",
    discount_percent: "0",
    tax_percent: "0",
  });

  const resetForm = () => {
    setFormData({
      description: "",
      quantity: "1",
      unit_price: "",
      discount_percent: "0",
      tax_percent: "0",
    });
    setIsAdding(false);
    setEditingId(null);
  };

  const handleAdd = async () => {
    await createItem.mutateAsync({
      deal_id: dealId,
      description: formData.description,
      quantity: parseFloat(formData.quantity) || 1,
      unit_price: parseFloat(formData.unit_price) || 0,
      discount_percent: parseFloat(formData.discount_percent) || 0,
      tax_percent: parseFloat(formData.tax_percent) || 0,
      display_order: items.length,
    });
    resetForm();
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    await updateItem.mutateAsync({
      id: editingId,
      description: formData.description,
      quantity: parseFloat(formData.quantity) || 1,
      unit_price: parseFloat(formData.unit_price) || 0,
      discount_percent: parseFloat(formData.discount_percent) || 0,
      tax_percent: parseFloat(formData.tax_percent) || 0,
    });
    resetForm();
  };

  const handleEdit = (item: CRMDealItem) => {
    setEditingId(item.id);
    setFormData({
      description: item.description,
      quantity: item.quantity.toString(),
      unit_price: item.unit_price.toString(),
      discount_percent: item.discount_percent.toString(),
      tax_percent: item.tax_percent.toString(),
    });
  };

  const handleDelete = async (id: string) => {
    await deleteItem.mutateAsync({ id, dealId });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency,
    }).format(value);
  };

  const total = calculateDealTotal(items);

  if (isLoading) {
    return <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Line Items</h3>
        {!isAdding && !editingId && (
          <Button variant="outline" size="sm" onClick={() => setIsAdding(true)}>
            <Plus className="h-3 w-3 mr-1" />Add Item
          </Button>
        )}
      </div>

      {items.length === 0 && !isAdding ? (
        <p className="text-sm text-muted-foreground text-center py-4">No line items yet</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead className="text-right w-16">Qty</TableHead>
              <TableHead className="text-right w-24">Price</TableHead>
              <TableHead className="text-right w-16">Disc %</TableHead>
              <TableHead className="text-right w-16">Tax %</TableHead>
              <TableHead className="text-right w-24">Total</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(item => (
              editingId === item.id ? (
                <TableRow key={item.id}>
                  <TableCell>
                    <Input
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                      className="h-8 w-16 text-right"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={formData.unit_price}
                      onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                      className="h-8 w-24 text-right"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={formData.discount_percent}
                      onChange={(e) => setFormData({ ...formData, discount_percent: e.target.value })}
                      className="h-8 w-16 text-right"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={formData.tax_percent}
                      onChange={(e) => setFormData({ ...formData, tax_percent: e.target.value })}
                      className="h-8 w-16 text-right"
                    />
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(
                      parseFloat(formData.quantity || '0') * 
                      parseFloat(formData.unit_price || '0') * 
                      (1 - parseFloat(formData.discount_percent || '0') / 100) *
                      (1 + parseFloat(formData.tax_percent || '0') / 100)
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleUpdate}>
                        <Save className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={resetForm}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow key={item.id} className="cursor-pointer" onClick={() => handleEdit(item)}>
                  <TableCell className="font-medium">{item.description}</TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                  <TableCell className="text-right">{item.discount_percent}%</TableCell>
                  <TableCell className="text-right">{item.tax_percent}%</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(calculateLineTotal(item))}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7" 
                      onClick={() => handleDelete(item.id)}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              )
            ))}
            
            {isAdding && (
              <TableRow>
                <TableCell>
                  <Input
                    placeholder="Description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="h-8"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    className="h-8 w-16 text-right"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={formData.unit_price}
                    onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                    className="h-8 w-24 text-right"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    value={formData.discount_percent}
                    onChange={(e) => setFormData({ ...formData, discount_percent: e.target.value })}
                    className="h-8 w-16 text-right"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    value={formData.tax_percent}
                    onChange={(e) => setFormData({ ...formData, tax_percent: e.target.value })}
                    className="h-8 w-16 text-right"
                  />
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(
                    parseFloat(formData.quantity || '0') * 
                    parseFloat(formData.unit_price || '0') * 
                    (1 - parseFloat(formData.discount_percent || '0') / 100) *
                    (1 + parseFloat(formData.tax_percent || '0') / 100)
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7" 
                      onClick={handleAdd}
                      disabled={!formData.description || createItem.isPending}
                    >
                      <Save className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={resetForm}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      {items.length > 0 && (
        <div className="flex justify-end pt-2 border-t">
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-xl font-bold">{formatCurrency(total)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
