// Domain Entity: Category
export interface Category {
    id: string;
    name: string;
    slug: string;
    icon: string | null;
    active: boolean;
    created_at: string;
}
