ALTER TABLE "businesses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "devices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "employees" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "time_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "billing_records" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "invoice_tax_lines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "system_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "combo_section_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "combo_sections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "modifier_groups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "modifiers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product_categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product_modifier_groups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product_variants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tables" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "zones" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "inventory_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product_recipes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "stock_movements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "cash_movements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "cash_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "order_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "order_item_modifiers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "businesses_tenant_select" ON "businesses" AS PERMISSIVE FOR SELECT TO public USING (public.has_business_access(id));--> statement-breakpoint
CREATE POLICY "customers_tenant_select" ON "customers" AS PERMISSIVE FOR SELECT TO public USING (public.has_business_access(business_id));--> statement-breakpoint
CREATE POLICY "devices_tenant_select" ON "devices" AS PERMISSIVE FOR SELECT TO public USING (public.has_business_access(business_id));--> statement-breakpoint
CREATE POLICY "employees_tenant_select" ON "employees" AS PERMISSIVE FOR SELECT TO public USING (public.has_business_access(business_id));--> statement-breakpoint
CREATE POLICY "memberships_tenant_select" ON "memberships" AS PERMISSIVE FOR SELECT TO public USING (user_id = (select auth.uid()) or organization_id in (select public.user_organization_ids()));--> statement-breakpoint
CREATE POLICY "organizations_tenant_select" ON "organizations" AS PERMISSIVE FOR SELECT TO public USING (id in (select public.user_organization_ids()));--> statement-breakpoint
CREATE POLICY "time_entries_tenant_select" ON "time_entries" AS PERMISSIVE FOR SELECT TO public USING (public.has_business_access(business_id));--> statement-breakpoint
CREATE POLICY "users_tenant_select" ON "users" AS PERMISSIVE FOR SELECT TO public USING (id = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "billing_records_tenant_select" ON "billing_records" AS PERMISSIVE FOR SELECT TO public USING (public.has_business_access(business_id));--> statement-breakpoint
CREATE POLICY "invoice_tax_lines_tenant_select" ON "invoice_tax_lines" AS PERMISSIVE FOR SELECT TO public USING (exists (select 1 from public.invoices i where i.id = invoice_id and public.has_business_access(i.business_id)));--> statement-breakpoint
CREATE POLICY "invoices_tenant_select" ON "invoices" AS PERMISSIVE FOR SELECT TO public USING (public.has_business_access(business_id));--> statement-breakpoint
CREATE POLICY "system_events_tenant_select" ON "system_events" AS PERMISSIVE FOR SELECT TO public USING (public.has_business_access(business_id));--> statement-breakpoint
CREATE POLICY "combo_section_items_tenant_select" ON "combo_section_items" AS PERMISSIVE FOR SELECT TO public USING (exists (select 1 from public.combo_sections cs join public.products p on p.id = cs.combo_product_id where cs.id = combo_section_id and public.has_business_access(p.business_id)));--> statement-breakpoint
CREATE POLICY "combo_sections_tenant_select" ON "combo_sections" AS PERMISSIVE FOR SELECT TO public USING (exists (select 1 from public.products p where p.id = combo_product_id and public.has_business_access(p.business_id)));--> statement-breakpoint
CREATE POLICY "modifier_groups_tenant_select" ON "modifier_groups" AS PERMISSIVE FOR SELECT TO public USING (public.has_business_access(business_id));--> statement-breakpoint
CREATE POLICY "modifiers_tenant_select" ON "modifiers" AS PERMISSIVE FOR SELECT TO public USING (exists (select 1 from public.modifier_groups g where g.id = modifier_group_id and public.has_business_access(g.business_id)));--> statement-breakpoint
CREATE POLICY "product_categories_tenant_select" ON "product_categories" AS PERMISSIVE FOR SELECT TO public USING (public.has_business_access(business_id));--> statement-breakpoint
CREATE POLICY "product_modifier_groups_tenant_select" ON "product_modifier_groups" AS PERMISSIVE FOR SELECT TO public USING (exists (select 1 from public.products p where p.id = product_id and public.has_business_access(p.business_id)));--> statement-breakpoint
CREATE POLICY "product_variants_tenant_select" ON "product_variants" AS PERMISSIVE FOR SELECT TO public USING (exists (select 1 from public.products p where p.id = product_id and public.has_business_access(p.business_id)));--> statement-breakpoint
CREATE POLICY "products_tenant_select" ON "products" AS PERMISSIVE FOR SELECT TO public USING (public.has_business_access(business_id));--> statement-breakpoint
CREATE POLICY "tables_tenant_select" ON "tables" AS PERMISSIVE FOR SELECT TO public USING (public.has_business_access(business_id));--> statement-breakpoint
CREATE POLICY "zones_tenant_select" ON "zones" AS PERMISSIVE FOR SELECT TO public USING (public.has_business_access(business_id));--> statement-breakpoint
CREATE POLICY "inventory_items_tenant_select" ON "inventory_items" AS PERMISSIVE FOR SELECT TO public USING (public.has_business_access(business_id));--> statement-breakpoint
CREATE POLICY "product_recipes_tenant_select" ON "product_recipes" AS PERMISSIVE FOR SELECT TO public USING (exists (select 1 from public.products p where p.id = product_id and public.has_business_access(p.business_id)));--> statement-breakpoint
CREATE POLICY "stock_movements_tenant_select" ON "stock_movements" AS PERMISSIVE FOR SELECT TO public USING (public.has_business_access(business_id));--> statement-breakpoint
CREATE POLICY "cash_movements_tenant_select" ON "cash_movements" AS PERMISSIVE FOR SELECT TO public USING (public.has_business_access(business_id));--> statement-breakpoint
CREATE POLICY "cash_sessions_tenant_select" ON "cash_sessions" AS PERMISSIVE FOR SELECT TO public USING (public.has_business_access(business_id));--> statement-breakpoint
CREATE POLICY "order_events_tenant_select" ON "order_events" AS PERMISSIVE FOR SELECT TO public USING (public.has_business_access(business_id));--> statement-breakpoint
CREATE POLICY "order_item_modifiers_tenant_select" ON "order_item_modifiers" AS PERMISSIVE FOR SELECT TO public USING (exists (select 1 from public.order_items oi join public.orders o on o.id = oi.order_id where oi.id = order_item_id and public.has_business_access(o.business_id)));--> statement-breakpoint
CREATE POLICY "order_items_tenant_select" ON "order_items" AS PERMISSIVE FOR SELECT TO public USING (exists (select 1 from public.orders o where o.id = order_id and public.has_business_access(o.business_id)));--> statement-breakpoint
CREATE POLICY "orders_tenant_select" ON "orders" AS PERMISSIVE FOR SELECT TO public USING (public.has_business_access(business_id));--> statement-breakpoint
CREATE POLICY "payments_tenant_select" ON "payments" AS PERMISSIVE FOR SELECT TO public USING (public.has_business_access(business_id));