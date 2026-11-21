import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import type { Address, Country } from "@/lib/types";
import { AddressManager } from "@/components/AddressManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Addresses" };

export default async function AddressesPage() {
  const user = await requireUser();
  const [addresses, countries] = await Promise.all([
    query<Address>(`SELECT a.address_id, a.address_line1, a.address_line2, a.city, a.region, a.postal_code,
                           a.country_id, co.country_name, a.is_default
                    FROM address a JOIN country co ON co.country_id = a.country_id
                    WHERE a.customer_id = $1 ORDER BY a.is_default DESC, a.address_id`, [user.customer_id]),
    query<Country>(`SELECT country_id, country_name FROM country ORDER BY country_name`),
  ]);
  return <AddressManager addresses={addresses} countries={countries} />;
}
