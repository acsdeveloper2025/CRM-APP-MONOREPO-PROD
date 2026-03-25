import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Edit, Plus, Search } from 'lucide-react';
import { useMutationWithInvalidation } from '@/hooks/useStandardizedMutation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { clientsService } from '@/services/clients';
import { productsService } from '@/services/products';
import { locationsService } from '@/services/locations';
import { serviceZoneRulesService } from '@/services/serviceZoneRules';
import type { ServiceZoneRule } from '@/types/rateManagement';

interface RuleFormState {
  clientId: string;
  productId: string;
  pincodeId: string;
  areaId: string;
  serviceZoneId: string;
}

const EMPTY_FORM: RuleFormState = {
  clientId: '',
  productId: '',
  pincodeId: '',
  areaId: '',
  serviceZoneId: '',
};

export function ServiceZoneRulesTab() {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingRule, setEditingRule] = useState<ServiceZoneRule | null>(null);
  const [formState, setFormState] = useState<RuleFormState>(EMPTY_FORM);

  const { data: rulesResponse, isLoading: loadingRules } = useQuery({
    queryKey: ['service-zone-rules'],
    queryFn: () => serviceZoneRulesService.listRules(),
  });
  const { data: serviceZonesResponse } = useQuery({
    queryKey: ['service-zones'],
    queryFn: () => serviceZoneRulesService.listServiceZones(),
  });
  const { data: clientsResponse } = useQuery({
    queryKey: ['clients', 'service-zone-rules'],
    queryFn: () => clientsService.getClients({ limit: 100 }),
  });
  const { data: productsResponse } = useQuery({
    queryKey: ['service-zone-products', formState.clientId],
    queryFn: () => productsService.getProductsByClient(formState.clientId),
    enabled: Boolean(formState.clientId),
  });
  const { data: pincodesResponse } = useQuery({
    queryKey: ['service-zone-pincodes'],
    queryFn: () => locationsService.getPincodes({ limit: 10000 }),
  });
  const { data: areasResponse } = useQuery({
    queryKey: ['service-zone-areas', formState.pincodeId],
    queryFn: () => locationsService.getAreasByPincode(Number(formState.pincodeId)),
    enabled: Boolean(formState.pincodeId),
  });

  const createRuleMutation = useMutationWithInvalidation({
    mutationFn: () =>
      serviceZoneRulesService.createRule({
        clientId: Number(formState.clientId),
        productId: Number(formState.productId),
        pincodeId: Number(formState.pincodeId),
        areaId: Number(formState.areaId),
        serviceZoneId: Number(formState.serviceZoneId),
      }),
    invalidateKeys: [['service-zone-rules']],
    successMessage: 'Service zone rule created successfully',
    errorContext: 'Service Zone Rules',
    errorFallbackMessage: 'Failed to create service zone rule',
    onSuccess: () => {
      setFormState(EMPTY_FORM);
      setEditingRule(null);
    },
  });

  const updateRuleMutation = useMutationWithInvalidation({
    mutationFn: () =>
      serviceZoneRulesService.updateRule(editingRule!.id, {
        clientId: Number(formState.clientId),
        productId: Number(formState.productId),
        pincodeId: Number(formState.pincodeId),
        areaId: Number(formState.areaId),
        serviceZoneId: Number(formState.serviceZoneId),
      }),
    invalidateKeys: [['service-zone-rules']],
    successMessage: 'Service zone rule updated successfully',
    errorContext: 'Service Zone Rules',
    errorFallbackMessage: 'Failed to update service zone rule',
    onSuccess: () => {
      setFormState(EMPTY_FORM);
      setEditingRule(null);
    },
  });

  const toggleRuleMutation = useMutationWithInvalidation({
    mutationFn: (rule: ServiceZoneRule) =>
      rule.isActive
        ? serviceZoneRulesService.deactivateRule(rule.id)
        : serviceZoneRulesService.activateRule(rule.id),
    invalidateKeys: [['service-zone-rules']],
    successMessage: 'Service zone rule status updated',
    errorContext: 'Service Zone Rules',
    errorFallbackMessage: 'Failed to update service zone rule status',
  });

  const clients = clientsResponse?.data || [];
  const products = productsResponse?.data || [];
  const pincodes = pincodesResponse?.data || [];
  const areas = areasResponse?.data || [];
  const serviceZones = serviceZonesResponse?.data || [];
  const rules = rulesResponse?.data || [];

  useEffect(() => {
    if (!formState.pincodeId) {
      if (formState.areaId) {
        setFormState((prev) => ({ ...prev, areaId: '' }));
      }
      return;
    }

    if (areas.length === 1 && formState.areaId !== String(areas[0].id)) {
      setFormState((prev) => ({ ...prev, areaId: String(areas[0].id) }));
    }

    if (formState.areaId && !areas.some((area) => String(area.id) === formState.areaId)) {
      setFormState((prev) => ({ ...prev, areaId: '' }));
    }
  }, [areas, formState.areaId, formState.pincodeId]);

  const filteredRules = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    if (!normalizedSearch) {
      return rules;
    }

    return rules.filter((rule) =>
      [rule.clientName, rule.productName, rule.pincodeCode, rule.areaName, rule.serviceZoneName]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedSearch))
    );
  }, [rules, searchQuery]);

  const canSubmit =
    formState.clientId &&
    formState.productId &&
    formState.pincodeId &&
    formState.areaId &&
    formState.serviceZoneId;

  const handleEdit = (rule: ServiceZoneRule) => {
    setEditingRule(rule);
    setFormState({
      clientId: String(rule.clientId),
      productId: String(rule.productId),
      pincodeId: String(rule.pincodeId),
      areaId: String(rule.areaId),
      serviceZoneId: String(rule.serviceZoneId),
    });
  };

  const handleFormChange = (field: keyof RuleFormState, value: string) => {
    setFormState((prev) => {
      if (field === 'clientId') {
        return { ...prev, clientId: value, productId: '' };
      }
      if (field === 'pincodeId') {
        return { ...prev, pincodeId: value, areaId: '' };
      }
      return { ...prev, [field]: value };
    });
  };

  const handleSubmit = () => {
    if (!canSubmit) {
      return;
    }

    if (editingRule) {
      updateRuleMutation.mutate();
      return;
    }

    createRuleMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{editingRule ? 'Edit Service Zone Rule' : 'Create Service Zone Rule'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label>Client *</Label>
              <Select value={formState.clientId} onValueChange={(value) => handleFormChange('clientId', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={String(client.id)}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Product *</Label>
              <Select
                value={formState.productId}
                onValueChange={(value) => handleFormChange('productId', value)}
                disabled={!formState.clientId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={formState.clientId ? 'Select product' : 'Select client first'} />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={String(product.id)}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Pincode *</Label>
              <Select value={formState.pincodeId} onValueChange={(value) => handleFormChange('pincodeId', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select pincode" />
                </SelectTrigger>
                <SelectContent>
                  {pincodes.map((pincode) => (
                    <SelectItem key={pincode.id} value={String(pincode.id)}>
                      {pincode.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Area *</Label>
              <Select
                value={formState.areaId}
                onValueChange={(value) => handleFormChange('areaId', value)}
                disabled={!formState.pincodeId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={formState.pincodeId ? 'Select area' : 'Select pincode first'} />
                </SelectTrigger>
                <SelectContent>
                  {areas.map((area) => (
                    <SelectItem key={area.id} value={String(area.id)}>
                      {area.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Service Zone *</Label>
              <Select
                value={formState.serviceZoneId}
                onValueChange={(value) => handleFormChange('serviceZoneId', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select zone" />
                </SelectTrigger>
                <SelectContent>
                  {serviceZones.map((zone) => (
                    <SelectItem key={zone.id} value={String(zone.id)}>
                      {zone.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {(createRuleMutation.error || updateRuleMutation.error) && (
            <Alert variant="destructive">
              <AlertDescription>
                {createRuleMutation.error?.message ||
                  updateRuleMutation.error?.message ||
                  'Unable to save service zone rule'}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center gap-3">
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit || createRuleMutation.isPending || updateRuleMutation.isPending}
            >
              {editingRule ? (
                <>
                  <Edit className="h-4 w-4 mr-2" />
                  Update Rule
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Rule
                </>
              )}
            </Button>
            {editingRule && (
              <Button
                variant="outline"
                onClick={() => {
                  setEditingRule(null);
                  setFormState(EMPTY_FORM);
                }}
              >
                Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configured Rules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by client, product, pincode or area"
              className="pl-10"
            />
          </div>

          {loadingRules ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
            </div>
          ) : filteredRules.length === 0 ? (
            <p className="py-8 text-center text-gray-600">No service zone rules found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Pincode</TableHead>
                  <TableHead>Area</TableHead>
                  <TableHead>Service Zone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell>{rule.clientName}</TableCell>
                    <TableCell>{rule.productName}</TableCell>
                    <TableCell>{rule.pincodeCode}</TableCell>
                    <TableCell>{rule.areaName}</TableCell>
                    <TableCell>{rule.serviceZoneName}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={rule.isActive}
                          onCheckedChange={() => toggleRuleMutation.mutate(rule)}
                          disabled={toggleRuleMutation.isPending}
                        />
                        <Badge variant={rule.isActive ? 'default' : 'secondary'}>
                          {rule.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(rule)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
