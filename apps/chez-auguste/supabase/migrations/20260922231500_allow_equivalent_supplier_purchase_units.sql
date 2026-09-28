-- FoodFlow can describe the same confirmed 1 L product as either one piece
-- (a one-litre bottle) or one litre. Keep the printed invoice unit on each
-- invoice line, but do not reject it when the normalized conversion is exactly
-- identical to the already-confirmed supplier product conversion.
update public.auguste_supplier_products as product
set purchase_unit = 'L'
from public.auguste_suppliers as supplier
where supplier.id = product.supplier_id
  and product.workspace_id = 'a617e000-0000-4000-8000-000000000001'::uuid
  and supplier.normalized_name = 'foodflow'
  and product.supplier_sku in ('FF-000283', 'FF-000284')
  and product.category = 'food'
  and product.conversion_status = 'confirmed'
  and product.base_unit = 'ml'
  and product.base_quantity_per_purchase_unit = 1000;

do $migration$
declare
  function_definition text;
  old_preflight text := $old$
      lower(v_product.category) <> r.category
      or lower(v_product.purchase_unit) <> lower(r.purchase_unit)
      or (
$old$;
  new_preflight text := $new$
      lower(v_product.category) <> r.category
      or (
        lower(v_product.purchase_unit) <> lower(r.purchase_unit)
        and not (
          v_product.conversion_status = 'confirmed'
          and r.conversion_status = 'confirmed'
          and lower(v_product.base_unit) is not distinct from r.base_unit
          and v_product.base_quantity_per_purchase_unit
            is not distinct from r.base_quantity
        )
      )
      or (
$new$;
  old_concurrent_check text := $old$
    if lower(v_product.category) <> r.clean_category
      or lower(v_product.purchase_unit) <> lower(r.clean_purchase_unit) then
$old$;
  new_concurrent_check text := $new$
    if lower(v_product.category) <> r.clean_category
      or (
        lower(v_product.purchase_unit) <> lower(r.clean_purchase_unit)
        and not (
          v_product.conversion_status = 'confirmed'
          and v_incoming_conversion_status = 'confirmed'
          and lower(v_product.base_unit)
            is not distinct from v_incoming_base_unit
          and v_product.base_quantity_per_purchase_unit
            is not distinct from v_incoming_base_quantity
        )
      ) then
$new$;
begin
  select pg_get_functiondef(
    'private.auguste_ingest_supplier_invoice(jsonb)'::regprocedure
  )
  into function_definition;

  if position(old_preflight in function_definition) > 0
    and position(old_concurrent_check in function_definition) > 0 then
    function_definition := replace(
      function_definition,
      old_preflight,
      new_preflight
    );
    function_definition := replace(
      function_definition,
      old_concurrent_check,
      new_concurrent_check
    );

    execute function_definition;
  elsif position(new_preflight in function_definition) > 0
    and position(new_concurrent_check in function_definition) > 0 then
    null;
  else
    raise exception
      'Unexpected auguste_ingest_supplier_invoice definition; migration not applied';
  end if;
end;
$migration$;
