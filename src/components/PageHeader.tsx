import { LucideIcon } from "lucide-react";

interface PageHeaderProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
}

export const PageHeader = ({ icon: Icon, title, description }: PageHeaderProps) => {
  return (
    <div className="flex items-start gap-3 mb-6">
      {Icon && <Icon className="h-8 w-8 text-primary flex-shrink-0 mt-1" />}
      <div>
        <h1 className="text-3xl font-bold">{title}</h1>
        {description && (
          <p className="text-muted-foreground mt-2">{description}</p>
        )}
      </div>
    </div>
  );
};