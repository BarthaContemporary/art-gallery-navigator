
import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Book, Users, Palette, FileText, Calendar, MapPin } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface TreeNode {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  href?: string;
  children?: TreeNode[];
}

const compendiumTree: TreeNode[] = [
  {
    id: 'artworks',
    label: 'Artworks',
    icon: Palette,
    href: '/artworks',
    children: [
      { id: 'artworks-all', label: 'All Artworks', href: '/artworks' },
      { id: 'artworks-available', label: 'Available', href: '/artworks?status=available' },
      { id: 'artworks-sold', label: 'Sold', href: '/artworks?status=sold' },
      { id: 'artworks-reserved', label: 'Reserved', href: '/artworks?status=reserved' },
    ]
  },
  {
    id: 'artists',
    label: 'Artists',
    icon: Users,
    href: '/artists',
    children: [
      { id: 'artists-all', label: 'All Artists', href: '/artists' },
      { id: 'artists-represented', label: 'Represented', href: '/artists?status=represented' },
      { id: 'artists-estate', label: 'Estate', href: '/artists?status=estate' },
    ]
  },
  {
    id: 'collections',
    label: 'Collections',
    icon: Book,
    href: '/collections'
  },
  {
    id: 'documents',
    label: 'Documents',
    icon: FileText,
    href: '/documents'
  },
  {
    id: 'crm',
    label: 'CRM',
    icon: Users,
    children: [
      { id: 'crm-clients', label: 'Clients', href: '/crm' },
      { id: 'crm-lists', label: 'Client Lists', href: '/crm/lists' },
    ]
  },
  {
    id: 'admin',
    label: 'Admin',
    children: [
      { id: 'admin-appointments', label: 'Appointments', href: '/appointments' },
      { id: 'admin-locations', label: 'Locations', href: '/locations' },
      { id: 'admin-image-repair', label: 'Image Repair', href: '/admin/image-repair' },
      { id: 'admin-image-health', label: 'Image Health', href: '/admin/image-health' },
    ]
  }
];

interface TreeNodeProps {
  node: TreeNode;
  level: number;
}

function TreeNodeComponent({ node, level }: TreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const location = useLocation();
  const hasChildren = node.children && node.children.length > 0;
  const isActive = node.href && location.pathname === node.href;

  const handleToggle = () => {
    if (hasChildren) {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer text-sm",
          "hover:bg-accent hover:text-accent-foreground",
          isActive && "bg-accent text-accent-foreground font-medium",
          level > 0 && "ml-4"
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleToggle}
      >
        {hasChildren ? (
          isExpanded ? (
            <ChevronDown className="w-4 h-4 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 flex-shrink-0" />
          )
        ) : (
          <div className="w-4 h-4 flex-shrink-0" />
        )}
        
        {node.icon && <node.icon className="w-4 h-4 flex-shrink-0" />}
        
        {node.href ? (
          <Link to={node.href} className="flex-1 truncate">
            {node.label}
          </Link>
        ) : (
          <span className="flex-1 truncate">{node.label}</span>
        )}
      </div>
      
      {hasChildren && isExpanded && (
        <div>
          {node.children!.map((child) => (
            <TreeNodeComponent key={child.id} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function CompendiumTreeView() {
  return (
    <div className="space-y-1">
      <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Compendium
      </div>
      {compendiumTree.map((node) => (
        <TreeNodeComponent key={node.id} node={node} level={0} />
      ))}
    </div>
  );
}
