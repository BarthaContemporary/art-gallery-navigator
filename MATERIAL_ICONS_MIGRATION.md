# Material Icons Migration Guide

This app now uses Google Material Symbols instead of Lucide React icons. Here's the migration mapping:

## Common Icon Mappings

### Navigation & UI
- `ChevronDown` → `expand_more`
- `ChevronUp` → `expand_less`
- `ChevronLeft` → `chevron_left`
- `ChevronRight` → `chevron_right`
- `ArrowLeft` → `arrow_back`
- `ArrowRight` → `arrow_forward`
- `X` → `close`
- `Plus` → `add`
- `Minus` → `remove`

### Actions
- `Edit` → `edit`
- `Delete`, `Trash2` → `delete`
- `Save` → `save`
- `Download` → `download`
- `Upload` → `file_upload`
- `Copy` → `content_copy`
- `Share` → `share`
- `Search` → `search`
- `Filter` → `filter_list`
- `Refresh`, `RefreshCw` → `refresh`

### Status & Feedback
- `Check` → `check`
- `CheckSquare` → `check_box`
- `AlertCircle` → `error`
- `Info` → `info`
- `Warning` → `warning`
- `Success` → `check_circle`

### Content & Media
- `Image`, `ImageIcon` → `image`
- `File` → `description`
- `Folder` → `folder`
- `Calendar` → `calendar_month`
- `Clock` → `schedule`
- `Mail` → `mail`

### People & Places
- `User`, `Users` → `people` or `person`
- `MapPin` → `location_on`
- `Home` → `home`

### Data & Analytics
- `TrendingUp` → `trending_up`
- `TrendingDown` → `trending_down`
- `Activity` → `pulse` or `analytics`
- `BarChart` → `bar_chart`
- `PieChart` → `pie_chart`

### Art & Creative
- `Palette` → `palette`
- `Paintbrush` → `brush`
- `Eye` → `visibility`
- `EyeOff` → `visibility_off`

## Usage

```tsx
import { MaterialIcon } from "@/components/ui/material-icon";

// Basic usage
<MaterialIcon icon="search" />

// With size
<MaterialIcon icon="search" size={20} />

// With custom styles
<MaterialIcon 
  icon="search" 
  size={16} 
  className="text-primary" 
/>

// Filled icons
<MaterialIcon 
  icon="favorite" 
  fill={true}
  className="text-red-500" 
/>
```

## Complete Migration Status

✅ **Completed:**
- Dashboard page
- Artworks page
- UI components (accordion, breadcrumb, calendar, carousel, checkbox, command, context-menu, dialog, dropdown-menu, select)

⏳ **Remaining:**
- All other components and pages throughout the app
- Remove lucide-react dependency when migration is complete

## Notes

- Material Symbols use different naming conventions (snake_case instead of PascalCase)
- Some icons may not have direct equivalents - choose the closest Material Symbol
- The MaterialIcon component supports all Material Symbols font features (fill, weight, grade, optical size)