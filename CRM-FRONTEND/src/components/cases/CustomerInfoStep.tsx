import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Search, ArrowRight, User, CreditCard, Phone, Hash } from 'lucide-react';

// Function to generate unique customer calling code
const generateCustomerCallingCode = (): string => {
  const timestamp = Date.now().toString();
  const randomDigits = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `CC-${timestamp}-${randomDigits}`;
};

const customerInfoSchema = z.object({
  customerName: z.string().min(1, 'Customer name is required').max(100, 'Customer name must be less than 100 characters'),
  customerCallingCode: z.string().min(1, 'Customer calling code is required'),
  panNumber: z.string().optional().refine((val) => !val || /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(val), {
    message: 'PAN must be in format: ABCDE1234F'
  }),
  mobileNumber: z.string().optional().refine((val) => !val || /^[0-9]{10,15}$/.test(val.replace(/\D/g, '')), {
    message: 'Mobile number must be 10-15 digits'
  }),
});

export type CustomerInfoData = z.infer<typeof customerInfoSchema>;

interface CustomerInfoStepProps {
  onSearchExisting: (data: CustomerInfoData) => void;
  onCreateNew: (data: CustomerInfoData) => void;
  isSearching?: boolean;
  initialData?: Partial<CustomerInfoData>;
  deduplicationCompleted?: boolean;
  onDataChange?: () => void;
}

export const CustomerInfoStep: React.FC<CustomerInfoStepProps> = ({
  onSearchExisting,
  onCreateNew,
  isSearching = false,
  initialData = {},
  deduplicationCompleted = false,
  onDataChange
}) => {
  const form = useForm<CustomerInfoData>({
    resolver: zodResolver(customerInfoSchema),
    defaultValues: {
      customerName: initialData.customerName || '',
      customerCallingCode: initialData.customerCallingCode || '',
      panNumber: initialData.panNumber || '',
      mobileNumber: initialData.mobileNumber || '',
    },
  });

  // Update form when initialData changes (for edit mode)
  useEffect(() => {
    if (initialData && Object.keys(initialData).length > 0) {
      form.reset({
        customerName: initialData.customerName || '',
        customerCallingCode: initialData.customerCallingCode || '',
        panNumber: initialData.panNumber || '',
        mobileNumber: initialData.mobileNumber || '',
      });
    }
  }, [initialData, form]);

  // Auto-generate customer calling code when component mounts or when customer name changes
  useEffect(() => {
    if (!form.getValues('customerCallingCode')) {
      const newCallingCode = generateCustomerCallingCode();
      form.setValue('customerCallingCode', newCallingCode);
    }
  }, [form]);

  // Watch for form changes to reset deduplication
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      // Reset deduplication when key fields change
      if (name && ['customerName', 'panNumber', 'mobileNumber'].includes(name) && deduplicationCompleted) {
        onDataChange?.();
      }
    });
    return () => subscription.unsubscribe();
  }, [form, deduplicationCompleted, onDataChange]);

  const handleSearchExisting = (data: CustomerInfoData) => {
    onSearchExisting(data);
  };

  const handleCreateNew = (data: CustomerInfoData) => {
    onCreateNew(data);
  };

  const watchedValues = form.watch();
  const hasMinimumData = watchedValues.customerName?.trim().length > 0;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">Customer Information</h2>
        <p className="text-muted-foreground">
          Enter customer details to search for existing cases or create a new one
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Customer Details
          </CardTitle>
          <CardDescription>
            Provide at least the customer name. Additional information helps with duplicate detection.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <div className="space-y-6">
              {/* Customer Name - Required */}
              <FormField
                control={form.control}
                name="customerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Customer Name *
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter customer full name"
                        {...field}
                        className="text-base"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Customer Calling Code - Auto-generated */}
              <FormField
                control={form.control}
                name="customerCallingCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Hash className="h-4 w-4" />
                      Customer Calling Code *
                      <span className="text-sm text-muted-foreground">(Auto-generated)</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        readOnly
                        className="text-base font-mono bg-muted"
                        placeholder="Auto-generated calling code"
                      />
                    </FormControl>
                    <FormMessage />
                    <p className="text-xs text-muted-foreground">
                      This unique code will be used for automatic call routing from the mobile app
                    </p>
                  </FormItem>
                )}
              />

              {/* PAN Number - Optional */}
              <FormField
                control={form.control}
                name="panNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      PAN Number
                      <span className="text-sm text-muted-foreground">(Optional)</span>
                    </FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="ABCDE1234F" 
                        {...field} 
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                        maxLength={10}
                        className="text-base font-mono"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Mobile Number - Optional */}
              <FormField
                control={form.control}
                name="mobileNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Mobile Number
                      <span className="text-sm text-muted-foreground">(Optional)</span>
                    </FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter 10-digit mobile number" 
                        {...field}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '');
                          field.onChange(value);
                        }}
                        maxLength={15}
                        className="text-base"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={form.handleSubmit(handleSearchExisting)}
                  disabled={!hasMinimumData || isSearching}
                  className="flex-1"
                >
                  {isSearching ? (
                    <>
                      <Search className="h-4 w-4 mr-2 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Search for Existing Cases
                    </>
                  )}
                </Button>
                
                <Button
                  type="button"
                  onClick={form.handleSubmit(handleCreateNew)}
                  disabled={!hasMinimumData || isSearching || !deduplicationCompleted}
                  className="flex-1"
                  title={!deduplicationCompleted ? "Please search for existing cases first" : ""}
                >
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Create New Case
                  {!deduplicationCompleted && (
                    <span className="ml-2 text-xs opacity-60">(Search Required)</span>
                  )}
                </Button>
              </div>

              {/* Help Text */}
              <div className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg">
                <p className="font-medium mb-2">Mandatory Deduplication Process</p>
                <ul className="space-y-1 text-xs">
                  <li>• <strong>Step 1:</strong> Search for existing cases to prevent duplicates</li>
                  <li>• <strong>Step 2:</strong> Review any potential duplicates found</li>
                  <li>• <strong>Step 3:</strong> Create new case only after deduplication check</li>
                </ul>
                {!deduplicationCompleted && (
                  <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded text-amber-800">
                    <p className="text-xs font-medium">⚠️ Deduplication search is required before creating a new case</p>
                  </div>
                )}
                {deduplicationCompleted && (
                  <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded text-green-800">
                    <p className="text-xs font-medium">✅ Deduplication check completed. You can now create a new case.</p>
                  </div>
                )}
              </div>
            </div>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};
