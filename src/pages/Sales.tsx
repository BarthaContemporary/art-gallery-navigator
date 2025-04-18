
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { 
  Plus, 
  Search, 
  Check, 
  Clock, 
  FileText, 
  AlertTriangle,
  DollarSign,
  Palette,
  User
} from "lucide-react";
import { Input } from "@/components/ui/input";

// Mock data for sales & offers
const mockSales = [
  {
    id: 1,
    artwork: {
      id: 5,
      title: "Vibrant Dreams",
      artist: "Amara Okafor",
      image_url: "https://images.unsplash.com/photo-1591280063444-d3c514eb6e13?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3"
    },
    client: {
      id: 1,
      name: "Jennifer Thompson"
    },
    date: "2025-04-15",
    price_offered: 9200,
    discount_percent: 0,
    final_price: 9200,
    status: "paid",
    invoice_url: "/invoices/INV-20250415-001.pdf"
  },
  {
    id: 2,
    artwork: {
      id: 2,
      title: "Summer Landscape",
      artist: "Michael Chen",
      image_url: "https://images.unsplash.com/photo-1579541591970-e5be9d3d85c6?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3"
    },
    client: {
      id: 3,
      name: "Sarah Williams"
    },
    date: "2025-04-10",
    price_offered: 6000,
    discount_percent: 0,
    final_price: 6000,
    status: "paid",
    invoice_url: "/invoices/INV-20250410-002.pdf"
  },
  {
    id: 3,
    artwork: {
      id: 4,
      title: "Blue Reflections",
      artist: "David Kim",
      image_url: "https://images.unsplash.com/photo-1549887534-1541e9326642?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3"
    },
    client: {
      id: 2,
      name: "Richard Chen"
    },
    date: "2025-04-17",
    price_offered: 7500,
    discount_percent: 0,
    final_price: 7500,
    status: "offered",
    invoice_url: null
  },
  {
    id: 4,
    artwork: {
      id: 1,
      title: "Abstract Composition #42",
      artist: "Emma Johnson",
      image_url: "https://images.unsplash.com/photo-1615921511258-0aa98c84d400?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3"
    },
    client: {
      id: 5,
      name: "Miguel Rodriguez"
    },
    date: "2025-04-14",
    price_offered: 7800,
    discount_percent: 5,
    final_price: 7410,
    status: "invoiced",
    invoice_url: "/invoices/INV-20250414-003.pdf"
  },
  {
    id: 5,
    artwork: {
      id: 3,
      title: "Urban Perspective",
      artist: "Sophia Rodriguez",
      image_url: "https://images.unsplash.com/photo-1561214115-f2f134cc4912?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3"
    },
    client: {
      id: 4,
      name: "Contemporary Art Museum"
    },
    date: "2025-04-05",
    price_offered: 4800,
    discount_percent: 10,
    final_price: 4320,
    status: "accepted",
    invoice_url: null
  }
];

// Helper function for status icons and colors
const getSaleStatusInfo = (status: string) => {
  switch (status) {
    case "offered":
      return { icon: <Clock className="h-4 w-4" />, color: "text-amber-500 bg-amber-50" };
    case "accepted":
      return { icon: <Check className="h-4 w-4" />, color: "text-blue-500 bg-blue-50" };
    case "invoiced":
      return { icon: <FileText className="h-4 w-4" />, color: "text-purple-500 bg-purple-50" };
    case "paid":
      return { icon: <DollarSign className="h-4 w-4" />, color: "text-green-500 bg-green-50" };
    case "declined":
      return { icon: <AlertTriangle className="h-4 w-4" />, color: "text-red-500 bg-red-50" };
    default:
      return { icon: <Clock className="h-4 w-4" />, color: "text-gray-500 bg-gray-50" };
  }
};

// Helper function to format date
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const Sales = () => {
  const [searchTerm, setSearchTerm] = useState("");
  
  const filteredSales = mockSales.filter(sale => 
    sale.artwork.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sale.artwork.artist.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sale.client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sale.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sales & Offers</h1>
          <p className="text-muted-foreground">
            Track sales, offers, and client inquiries
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> New Offer
        </Button>
      </div>

      <div className="mb-6">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search sales and offers..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-6">
        {filteredSales.map((sale) => {
          const { icon, color } = getSaleStatusInfo(sale.status);
          
          return (
            <Card key={sale.id}>
              <div className="flex flex-col md:flex-row">
                <div className="md:w-1/4 lg:w-1/5">
                  <div className="aspect-square w-full overflow-hidden">
                    <img
                      src={sale.artwork.image_url}
                      alt={sale.artwork.title}
                      className="h-full w-full object-cover"
                    />
                  </div>
                </div>
                <div className="flex-1 p-4 md:p-6">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`w-8 h-8 rounded-full ${color} flex items-center justify-center`}>
                          {icon}
                        </div>
                        <span className="font-medium capitalize">{sale.status}</span>
                      </div>
                      <div className="flex items-start gap-2 mb-4">
                        <Palette className="h-4 w-4 mt-1 text-muted-foreground" />
                        <div>
                          <h3 className="font-semibold text-lg">{sale.artwork.title}</h3>
                          <p className="text-sm">{sale.artwork.artist}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 mb-4">
                        <User className="h-4 w-4 mt-0.5 text-muted-foreground" />
                        <span className="text-sm">{sale.client.name}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatDate(sale.date)}
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <div className="text-2xl font-bold">
                        ${sale.final_price.toLocaleString()}
                      </div>
                      {sale.discount_percent > 0 && (
                        <div className="text-sm text-muted-foreground">
                          <span className="line-through">${sale.price_offered.toLocaleString()}</span>
                          <span className="ml-1">({sale.discount_percent}% discount)</span>
                        </div>
                      )}
                      {sale.invoice_url && (
                        <Button variant="outline" size="sm" className="mt-4">
                          <FileText className="mr-2 h-4 w-4" /> View Invoice
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default Sales;
