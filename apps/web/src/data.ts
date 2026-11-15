export const money = (n: number) => "$ " + n.toLocaleString("es-AR");
export const photos = {
  coffee:
    "https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=700&q=85",
  croissant:
    "https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=700&q=85",
  toast:
    "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=700&q=85",
  cake: "https://images.unsplash.com/photo-1464305795204-6f5bbfc7fb81?auto=format&fit=crop&w=700&q=85",
  shop: "https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&w=1600&q=85",
};
export type Product = {
  id: number;
  name: string;
  category: string;
  description: string;
  price: number;
  image: string;
  available: boolean;
  onlineVisible?: boolean;
};
export const products: Product[] = [
  {
    id: 1,
    name: "Flat white",
    category: "Café",
    description: "Doble espresso, leche texturizada y el equilibrio perfecto.",
    price: 3800,
    image: photos.coffee,
    available: true,
  },
  {
    id: 2,
    name: "Croissant de manteca",
    category: "Panadería",
    description: "Capas doradas, manteca de verdad. Horneado cada mañana.",
    price: 3200,
    image: photos.croissant,
    available: true,
  },
  {
    id: 3,
    name: "Avocado toast",
    category: "Brunch",
    description: "Pan de masa madre, palta, huevo y un toque de limón.",
    price: 8500,
    image: photos.toast,
    available: true,
  },
  {
    id: 4,
    name: "Latte de la casa",
    category: "Café",
    description: "Nuestro blend de especialidad con leche suave y cremosa.",
    price: 4200,
    image: photos.coffee,
    available: true,
  },
  {
    id: 5,
    name: "Torta del día",
    category: "Pastelería",
    description: "Una porción de algo rico, hecha en nuestra cocina.",
    price: 5500,
    image: photos.cake,
    available: true,
  },
  {
    id: 6,
    name: "Croissant relleno",
    category: "Panadería",
    description: "Nuestro clásico con jamón natural y queso fundido.",
    price: 4800,
    image: photos.croissant,
    available: true,
  },
];
export const defaultCategories = ["Café", "Panadería", "Brunch", "Pastelería"];
