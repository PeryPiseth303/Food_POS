import { redirect } from "next/navigation";

export default function HomePage() {
  // Users who visit directly without scanning a physical table QR code go straight to the delivery page
  redirect("/menu?mode=delivery");
}
