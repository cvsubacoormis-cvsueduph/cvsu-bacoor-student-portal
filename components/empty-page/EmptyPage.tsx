import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty"
import { cn } from "@/lib/utils"
import { LucideIcon } from "lucide-react"

interface EmptyPageProps extends React.ComponentProps<typeof Empty> {
    title: string
    description?: string
    icon?: LucideIcon
    action?: React.ReactNode
    className?: string
}

export default function EmptyPage({
    title,
    description,
    icon: Icon,
    action,
    className,
    ...props
}: EmptyPageProps) {
    return (
        <Empty className={cn("min-h-[400px]", className)} {...props}>
            <EmptyHeader>
                {Icon && (
                    <EmptyMedia>
                        <div className="flex size-20 items-center justify-center rounded-full bg-blue-700">
                            <Icon className="size-10 text-white" />
                        </div>
                    </EmptyMedia>
                )}
                <EmptyTitle>{title}</EmptyTitle>
                {description && <EmptyDescription>{description}</EmptyDescription>}
            </EmptyHeader>
            {action && <EmptyContent>{action}</EmptyContent>}
        </Empty>
    )
}
