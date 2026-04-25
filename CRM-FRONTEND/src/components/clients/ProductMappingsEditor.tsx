import { useStandardizedQuery } from '@/hooks/useStandardizedQuery';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { productsService } from '@/services/products';
import { verificationTypesService } from '@/services/verificationTypes';
import { documentTypesService } from '@/services/documentTypes';

export interface ProductMapping {
  productId: number;
  verificationTypeIds: number[];
  documentTypeIds: number[];
}

interface ProductMappingsEditorProps {
  value: ProductMapping[];
  onChange: (next: ProductMapping[]) => void;
  enabled?: boolean;
}

/**
 * Per-product verification + document type mapping editor.
 * Shows every available product; checking it expands inline pickers
 * for VTs and DocTypes scoped to that (client, product) tuple.
 */
export function ProductMappingsEditor({
  value,
  onChange,
  enabled = true,
}: ProductMappingsEditorProps) {
  const { data: productsData } = useStandardizedQuery({
    queryKey: ['products', 'all-for-mapping'],
    queryFn: () => productsService.getProducts({ limit: 500 }),
    enabled,
    errorContext: 'Loading Products',
    errorFallbackMessage: 'Failed to load products',
  });

  const { data: vtData } = useStandardizedQuery({
    queryKey: ['verification-types', 'all-for-mapping'],
    queryFn: () => verificationTypesService.getVerificationTypes({ limit: 500 }),
    enabled,
    errorContext: 'Loading Verification Types',
    errorFallbackMessage: 'Failed to load verification types',
  });

  const { data: dtData } = useStandardizedQuery({
    queryKey: ['document-types', 'all-for-mapping'],
    queryFn: () => documentTypesService.getDocumentTypes({ limit: 500 }),
    enabled,
    errorContext: 'Loading Document Types',
    errorFallbackMessage: 'Failed to load document types',
  });

  const products = productsData?.data || [];
  const verificationTypes = vtData?.data || [];
  const documentTypes = dtData?.data || [];

  const isProductSelected = (pid: number) => value.some((m) => m.productId === pid);
  const getMapping = (pid: number) =>
    value.find((m) => m.productId === pid) || {
      productId: pid,
      verificationTypeIds: [],
      documentTypeIds: [],
    };

  const toggleProduct = (pid: number, checked: boolean) => {
    if (checked) {
      onChange([...value, { productId: pid, verificationTypeIds: [], documentTypeIds: [] }]);
    } else {
      onChange(value.filter((m) => m.productId !== pid));
    }
  };

  const updateMapping = (pid: number, patch: Partial<ProductMapping>) => {
    onChange(value.map((m) => (m.productId === pid ? { ...m, ...patch } : m)));
  };

  const toggleVT = (pid: number, vtId: number, checked: boolean) => {
    const current = getMapping(pid).verificationTypeIds;
    updateMapping(pid, {
      verificationTypeIds: checked
        ? Array.from(new Set([...current, vtId]))
        : current.filter((id) => id !== vtId),
    });
  };

  const toggleDT = (pid: number, dtId: number, checked: boolean) => {
    const current = getMapping(pid).documentTypeIds;
    updateMapping(pid, {
      documentTypeIds: checked
        ? Array.from(new Set([...current, dtId]))
        : current.filter((id) => id !== dtId),
    });
  };

  if (!products.length) {
    return (
      <div className="text-sm text-gray-600 border rounded-md p-4">
        No products available. Create products first.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-600">
        Check a product to assign it to this client, then pick verification types and document types
        for that (client, product) combination.
      </p>
      {products.map((product) => {
        const selected = isProductSelected(product.id);
        const mapping = getMapping(product.id);
        return (
          <div
            key={product.id}
            className={`rounded-md border p-3 ${selected ? 'bg-muted/30' : ''}`}
          >
            <div className="flex items-center space-x-2">
              <Checkbox
                id={`pm-product-${product.id}`}
                checked={selected}
                onCheckedChange={(c) => toggleProduct(product.id, Boolean(c))}
              />
              <label
                htmlFor={`pm-product-${product.id}`}
                className="text-sm font-medium leading-none cursor-pointer"
              >
                {product.name}
                <Badge variant="outline" className="ml-2 text-xs">
                  {product.code}
                </Badge>
              </label>
            </div>

            {selected && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 pl-6">
                <div>
                  <h5 className="text-xs font-medium text-gray-700 mb-1">Verification Types</h5>
                  <ScrollArea className="h-40 w-full border rounded p-2 bg-background">
                    {verificationTypes.length ? (
                      <div className="space-y-1">
                        {verificationTypes.map((vt) => (
                          <div key={vt.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`pm-${product.id}-vt-${vt.id}`}
                              checked={mapping.verificationTypeIds.includes(vt.id)}
                              onCheckedChange={(c) => toggleVT(product.id, vt.id, Boolean(c))}
                            />
                            <label
                              htmlFor={`pm-${product.id}-vt-${vt.id}`}
                              className="text-xs cursor-pointer"
                            >
                              {vt.name}
                            </label>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500">No verification types</div>
                    )}
                  </ScrollArea>
                </div>

                <div>
                  <h5 className="text-xs font-medium text-gray-700 mb-1">Document Types</h5>
                  <ScrollArea className="h-40 w-full border rounded p-2 bg-background">
                    {documentTypes.length ? (
                      <div className="space-y-1">
                        {documentTypes.map((dt) => (
                          <div key={dt.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`pm-${product.id}-dt-${dt.id}`}
                              checked={mapping.documentTypeIds.includes(dt.id)}
                              onCheckedChange={(c) => toggleDT(product.id, dt.id, Boolean(c))}
                            />
                            <label
                              htmlFor={`pm-${product.id}-dt-${dt.id}`}
                              className="text-xs cursor-pointer"
                            >
                              {dt.name}
                            </label>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500">No document types</div>
                    )}
                  </ScrollArea>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
