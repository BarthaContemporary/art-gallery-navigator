
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Plus, Search, User, Mail, Phone, MapPin, Tags } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

// Mock data for clients
const mockClients = [
  {
    id: 1,
    full_name: "Jennifer Thompson",
    email: "jennifer.thompson@example.com",
    phone: "(212) 555-1234",
    address: "450 Park Avenue, New York, NY 10022",
    notes: "Interested in contemporary photography and abstract painting. Regular attendee at gallery openings.",
    client_type: "collector",
    interest_tags: ["abstract", "photography", "emerging artists"],
    artworks_acquired: 8
  },
  {
    id: 2,
    full_name: "Richard Chen",
    email: "richard.chen@example.com",
    phone: "(415) 555-8765",
    address: "1850 Mission Street, San Francisco, CA 94103",
    notes: "Major contemporary art collector with focus on Asian and Asian-American artists.",
    client_type: "collector",
    interest_tags: ["installation", "multimedia", "conceptual"],
    artworks_acquired: 15
  },
  {
    id: 3,
    full_name: "Sarah Williams",
    email: "swilliams@designfirm.com",
    phone: "(310) 555-3421",
    address: "8500 Beverly Blvd, Los Angeles, CA 90048",
    notes: "Interior designer who frequently sources works for high-end residential clients.",
    client_type: "interior designer",
    interest_tags: ["abstract", "sculpture", "large format"],
    artworks_acquired: 23
  },
  {
    id: 4,
    full_name: "Contemporary Art Museum",
    email: "acquisitions@cammuseum.org",
    phone: "(312) 555-9876",
    address: "220 E Chicago Ave, Chicago, IL 60611",
    notes: "Mid-sized museum with growing contemporary collection. Potential for institutional acquisition.",
    client_type: "institution",
    interest_tags: ["video art", "installation", "emerging artists"],
    artworks_acquired: 5
  },
  {
    id: 5,
    full_name: "Miguel Rodriguez",
    email: "miguel@artcollection.com",
    phone: "(305) 555-6543",
    address: "100 S Biscayne Blvd, Miami, FL 33131",
    notes: "International collector focused on Latin American contemporary art. Visits during Art Basel Miami.",
    client_type: "collector",
    interest_tags: ["painting", "sculpture", "Latin American"],
    artworks_acquired: 11
  }
];

// Helper function for client type badge color
const getClientTypeColor = (type: string) => {
  switch (type) {
    case "collector":
      return "bg-blue-100 text-blue-800";
    case "interior designer":
      return "bg-amber-100 text-amber-800";
    case "institution":
      return "bg-purple-100 text-purple-800";
    case "curator":
      return "bg-green-100 text-green-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

const Clients = () => {
  const [searchTerm, setSearchTerm] = useState("");
  
  const filteredClients = mockClients.filter(client => 
    client.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.client_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.interest_tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
          <p className="text-muted-foreground">
            Manage collectors, institutions, and art professionals
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Add Client
        </Button>
      </div>

      <div className="mb-6">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search clients..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredClients.map((client) => (
          <Card key={client.id}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <User className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{client.full_name}</h3>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full capitalize ${getClientTypeColor(client.client_type)}`}>
                      {client.client_type}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {client.artworks_acquired} artworks acquired
                    </span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:${client.email}`} className="text-sm hover:underline">{client.email}</a>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{client.phone}</span>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <span className="text-sm">{client.address}</span>
                </div>
                <div className="flex items-start gap-2">
                  <Tags className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div className="flex flex-wrap gap-1">
                    {client.interest_tags.map((tag, index) => (
                      <Badge key={index} variant="outline" className="text-xs">{tag}</Badge>
                    ))}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground pt-2">{client.notes}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Clients;
