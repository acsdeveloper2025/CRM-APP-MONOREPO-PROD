import { useQuery } from '@tanstack/react-query';
import { verificationImagesService } from '@/services/verificationImages';

// Query key factory for verification images
export const verificationImageKeys = {
  all: ['verification-images'] as const,
  case: (caseId: string) => [...verificationImageKeys.all, 'case', caseId] as const,
  submission: (caseId: string, submissionId: string) =>
    [...verificationImageKeys.case(caseId), 'submission', submissionId] as const,
};

/**
 * Hook to get all verification images for a case (for form submission display)
 */
export const useVerificationImages = (
  caseId: string,
  options: { enabled?: boolean } = {}
) => {
  return useQuery({
    queryKey: [...verificationImageKeys.case(caseId), 'all'],
    queryFn: () => verificationImagesService.getVerificationImages(caseId),
    enabled: !!caseId && (options.enabled !== false),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Hook to get verification images by submission ID
 */
export const useVerificationImagesBySubmission = (
  caseId: string, 
  submissionId: string,
  options: { enabled?: boolean } = {}
) => {
  return useQuery({
    queryKey: verificationImageKeys.submission(caseId, submissionId),
    queryFn: () => verificationImagesService.getVerificationImagesBySubmission(caseId, submissionId),
    enabled: !!caseId && !!submissionId && (options.enabled !== false),
    staleTime: 5 * 60 * 1000,
  });
};


