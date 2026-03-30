// Disabled require-await rule for template report service as some async functions don't directly await
import { logger } from '../utils/logger';

/**
 * Template-based Report Generation Service
 * Generates structured reports using predefined templates for different verification types and outcomes
 */

export interface TemplateReportResult {
  success: boolean;
  report?: string;
  error?: string;
  metadata?: {
    verificationType: string;
    outcome: string;
    generatedAt: string;
    templateUsed: string;
  };
}

export interface VerificationCaseDetails {
  caseId: string;
  customerName: string;
  address: string;
  applicantType?: string;
  [key: string]: unknown;
}

export interface VerificationReportData {
  verificationType: string;
  outcome: string;
  formData: Record<string, unknown>;
  caseDetails: VerificationCaseDetails;
}

export class TemplateReportService {
  private readonly RESIDENCE_TEMPLATES = {
    POSITIVE_DOOR_OPEN: `Residence Remark: POSITIVE & DOOR OPEN.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is locatable and rated as {Address_Rating}. At the time of visit, met with {Met_Person_Name} ({Met_Person_Relation}), who confirmed {Customer_Name}'s stay and provided the details. {Customer_Name} has been staying at the given address since {Staying_Period} as {Staying_Status}.

PROPERTY & PERSONAL DETAILS:
The approximate area of the premises is {Approx_Area_Sq_Feet}. Total family members are {Total_Family_Members} and earning members are {Total_Earning_Members}. {Customer_Name} is {Working_Status} at {Company_Name}. The door nameplate {Door_Name_Plate_Text}. Society board {Society_Name_Plate_Text}.

LOCALITY INFORMATION:
The locality is {Locality} with an address structure of G+{Address_Structure_G_Plus}. {Customer_Name} is staying on the {Applicant_Staying_Floor} floor. The building color is {Address_Structure_Color} and door color is {Door_Color}. During the visit, the met person showed {Document_Type} as identity proof.

THIRD PARTY CONFIRMATION:
TPC was conducted with {Name_of_TPC_1}, who {TPC_Confirmation_1} {Customer_Name}'s name and stay. Second TPC was done with {Name_of_TPC_2}, who also {TPC_Confirmation_2} {Customer_Name}'s residence.

AREA ASSESSMENT:
Landmarks nearby: {Landmark_1} and {Landmark_2}. {Dominated_Area_Text}. {Feedback_from_Neighbour} feedback was received from neighbours. {Political_Connection_Text}. {Customer_Name}'s stay is confirmed by the field executive's observation as well as from TPC.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    POSITIVE_DOOR_LOCKED: `Residence Remark: POSITIVE & DOOR LOCKED.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is locatable and rated as {Address_Rating}. At the time of visit, the door was {House_Status}.

THIRD PARTY CONFIRMATION:
TPC was conducted with {Name_of_TPC_1}, who {TPC_Confirmation_1} {Customer_Name}'s name and stay at the given address. Second TPC was done with {Name_of_TPC_2}, who also {TPC_Confirmation_2} {Customer_Name}'s residence. It is confirmed that {Customer_Name} has been staying at the given address since {Staying_Period} as {Staying_Status}.

PROPERTY & PERSONAL DETAILS:
The approximate area of the premises is {Approx_Area_Sq_Feet}. Total family members are {Total_Family_Members} and earning members are {Total_Earning_Members}. {Customer_Name} is {Working_Status} at {Company_Name}. The door nameplate {Door_Name_Plate_Text}. Society board {Society_Name_Plate_Text}.

LOCALITY INFORMATION:
The locality is {Locality} with an address structure of G+{Address_Structure_G_Plus}. {Customer_Name} is staying on the {Applicant_Staying_Floor} floor. The building color is {Address_Structure_Color} and door color is {Door_Color}. During the visit, the met person showed {Document_Type} as identity proof.

AREA ASSESSMENT:
Landmarks nearby: {Landmark_1} and {Landmark_2}. {Dominated_Area_Text}. {Feedback_from_Neighbour} feedback was received from neighbours. {Political_Connection_Text}. {Customer_Name}'s stay is confirmed by the field executive's observation as well as from TPC.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    SHIFTED_DOOR_OPEN: `Residence Remark: SHIFTED & DOOR OPEN.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is locatable and rated as {Address_Rating}. At the time of visit, the door was {House_Status}. Met with {Met_Person_Name} ({Met_Person_Relation}), who informed that {Customer_Name} has shifted to another address since the last {Shifted_Period}.

PROPERTY DETAILS:
The door nameplate {Door_Name_Plate_Text}. Society board {Society_Name_Plate_Text}. At present, the given premises is {Premises_Status}.

LOCALITY INFORMATION:
The locality is {Locality} with an address structure of G+{Address_Structure_G_Plus}. The building color is {Address_Structure_Color} and door color is {Door_Color}.

THIRD PARTY CONFIRMATION:
TPC was conducted with {Name_of_TPC_1} and {Name_of_TPC_2}, who informed that {Customer_Name} has shifted from the given address.

AREA ASSESSMENT:
Landmarks nearby: {Landmark_1} and {Landmark_2}. {Dominated_Area_Text}. {Feedback_from_Neighbour} feedback was received from neighbours. {Political_Connection_Text}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    SHIFTED_DOOR_LOCKED: `Residence Remark: SHIFTED & DOOR LOCKED.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is locatable and rated as {Address_Rating}. At the time of visit, the door was locked.

THIRD PARTY CONFIRMATION:
TPC was conducted with {Name_of_TPC_1} and {Name_of_TPC_2}, who informed that {Customer_Name} has shifted from the given address since the last {Shifted_Period}.

PROPERTY DETAILS:
At present, the given premises is {Premises_Status}. The door nameplate {Door_Name_Plate_Text}. Society board {Society_Name_Plate_Text}.

LOCALITY INFORMATION:
The locality is {Locality} with an address structure of G+{Address_Structure_G_Plus}. The building color is {Address_Structure_Color} and door color is {Door_Color}.

AREA ASSESSMENT:
Landmarks nearby: {Landmark_1} and {Landmark_2}. {Dominated_Area_Text}. {Feedback_from_Neighbour} feedback was received from neighbours. {Political_Connection_Text}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    ERT: `Residence Remark: ENTRY RESTRICTED.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is locatable and rated as {Address_Rating}. At the time of visit, met with {Name_of_Met_Person} ({Met_Person_Type}), who informed that entry to the given premises is not allowed.

ENTRY RESTRICTION DETAILS:
{Name_of_Met_Person} {Met_Person_Confirmation} that {Customer_Name} is {Applicant_Staying_Status} at the given address. Society board {Society_Name_Plate_Text}.

LOCALITY INFORMATION:
The locality is {Locality} with an address structure of G+{Address_Structure_G_Plus}. The building color is {Address_Structure_Color} and door color is {Door_Color}.

AREA ASSESSMENT:
Landmarks nearby: {Landmark_1} and {Landmark_2}. {Dominated_Area_Text}. {Feedback_from_Neighbour} feedback was received from the met person. {Political_Connection_Text}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    UNTRACEABLE: `Residence Remark: UNTRACEABLE.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is incorrect and untraceable.

CONTACT ATTEMPT:
We called {Customer_Name}, but {Call_Remark}. Proper guidance is required to trace the address.

LOCALITY INFORMATION:
The locality type is {Locality}. Field executive reached up to the following landmarks: {Landmark_1}, {Landmark_2}, {Landmark_3}, {Landmark_4}. {Dominated_Area_Text}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    NSP_DOOR_OPEN: `Residence Remark: NSP & DOOR OPEN (No Such Person).

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is locatable and rated as {Address_Rating}. At the time of visit, the door was {House_Status}. Met with {Met_Person_Name} ({Met_Person_Relation}), who informed that there is no such person staying at the given address.

CURRENT RESIDENT INFORMATION:
The met person has been staying at the given address for the last {Staying_Period}. As per the current resident, {Customer_Name} has never stayed at this address.

PROPERTY DETAILS:
The door nameplate {Door_Name_Plate_Text}. Society board {Society_Name_Plate_Text}.

LOCALITY INFORMATION:
The locality is {Locality} with an address structure of G+{Address_Structure_G_Plus}. The building color is {Address_Structure_Color} and door color is {Door_Color}.

THIRD PARTY CONFIRMATION:
TPC was conducted with {Name_of_TPC_1} and {Name_of_TPC_2}, who confirmed that no such person is staying at the given address.

AREA ASSESSMENT:
Landmarks nearby: {Landmark_1} and {Landmark_2}. {Dominated_Area_Text}. {Customer_Name}'s presence at this address is not confirmed by the field executive's observation or from TPC.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    NSP_DOOR_LOCKED: `Residence Remark: NSP & DOOR LOCKED.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is locatable and rated as {Address_Rating}. At the time of visit, the door was locked.

THIRD PARTY CONFIRMATION:
TPC was conducted with {Name_of_TPC_1} and {Name_of_TPC_2}, who informed that no such person ({Customer_Name}) is staying at the given address.

PROPERTY DETAILS:
The door nameplate {Door_Name_Plate_Text}. Society board {Society_Name_Plate_Text}.

LOCALITY INFORMATION:
The locality is {Locality} with an address structure of G+{Address_Structure_G_Plus}. The building color is {Address_Structure_Color} and door color is {Door_Color}.

AREA ASSESSMENT:
Landmarks nearby: {Landmark_1} and {Landmark_2}. {Dominated_Area_Text}. {Customer_Name}'s presence at this address is not confirmed by the field executive's observation or from TPC.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,
  };

  private readonly OFFICE_TEMPLATES = {
    POSITIVE_DOOR_OPEN: `Office Remark: POSITIVE & DOOR OPEN.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is locatable and rated as {Address_Rating}. At the time of visit, the office was {Office_Status}. Met with {Met_Person_Name} ({Designation}), who confirmed that {Customer_Name} has been working at the given office since the last {Working_Period} as {Applicant_Designation}.

EMPLOYMENT & OFFICE DETAILS:
{Customer_Name} works as {Applicant_Designation} and sits at {Applicant_Working_Premises} {Sitting_Location}. It is a {Office_Type} office and the nature of business is {Company_Nature_Of_Business}. Total staff strength is {Staff_Strength} and {Staff_Seen} were seen during the visit. Office area is approximately {Office_Approx_Area}. Company nameplate {Company_Name_Plate_Text}.

LOCALITY INFORMATION:
The locality is {Locality} with an address structure of G+{Address_Structure_G_Plus}. The building color is {Address_Structure_Color} and door color is {Door_Color}.

THIRD PARTY CONFIRMATION:
TPC was conducted with {Name_of_TPC_1}, who {TPC_Confirmation_1} {Customer_Name}'s employment and office existence. Second TPC was done with {Name_of_TPC_2}, who also {TPC_Confirmation_2} the same.

AREA ASSESSMENT:
Landmarks nearby: {Landmark_1} and {Landmark_2}. {Dominated_Area_Text}. {Feedback_from_Neighbour} feedback was received regarding {Customer_Name} and the firm. {Political_Connection_Text}. {Customer_Name}'s employment is confirmed by the field executive's observation as well as from TPC.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    POSITIVE_DOOR_LOCKED: `Office Remark: POSITIVE & DOOR LOCKED.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is locatable and rated as {Address_Rating}. At the time of visit, the office was {Office_Status}.

THIRD PARTY CONFIRMATION:
TPC was conducted with {Name_of_TPC_1} and {Name_of_TPC_2}, who {TPC_Confirmation_1} {Customer_Name}'s employment and office existence. They informed that {Customer_Name} has been working at the given office since the last {Working_Period}.

OFFICE & COMPANY DETAILS:
Company nameplate {Company_Name_Plate_Text}. Office area is approximately {Office_Approx_Area}. The nature of business is {Company_Nature_Of_Business}.

LOCALITY INFORMATION:
The locality is {Locality} with an address structure of G+{Address_Structure_G_Plus}. The building color is {Address_Structure_Color} and door color is {Door_Color}.

AREA ASSESSMENT:
Landmarks nearby: {Landmark_1} and {Landmark_2}. {Dominated_Area_Text}. {Feedback_from_Neighbour} feedback was received from neighbours. {Political_Connection_Text}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    SHIFTED_DOOR_OPEN: `Office Remark: SHIFTED & DOOR OPEN.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is locatable and rated as {Address_Rating}. At the time of visit, the office was {Office_Status}. Met with {Met_Person_Name} ({Designation}), who confirmed that the company has shifted from the given address {Old_Office_Shifted_Period} ago.

CURRENT OFFICE STATUS:
{Current_Company_Name} is currently operating at the given address since the last {Current_Company_Period}. Company nameplate {Company_Name_Plate_Text}.

LOCALITY INFORMATION:
The locality is {Locality} with an address structure of G+{Address_Structure_G_Plus}. The building color is {Address_Structure_Color} and door color is {Door_Color}.

THIRD PARTY CONFIRMATION:
TPC was conducted with {Name_of_TPC_1} and {Name_of_TPC_2}, who confirmed that the company has shifted from the given address {Old_Office_Shifted_Period} ago.

AREA ASSESSMENT:
Landmarks nearby: {Landmark_1} and {Landmark_2}. {Dominated_Area_Text}. {Feedback_from_Neighbour} feedback was received from neighbours. {Political_Connection_Text}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    SHIFTED_DOOR_LOCKED: `Office Remark: SHIFTED & DOOR LOCKED.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is locatable and rated as {Address_Rating}. At the time of visit, the office was closed.

THIRD PARTY CONFIRMATION:
TPC was conducted with {Name_of_TPC_1} and {Name_of_TPC_2}, who confirmed that the company has shifted from the given address {Old_Office_Shifted_Period} ago.

CURRENT OFFICE STATUS:
{Current_Company_Name} is currently operating at the given address. Company nameplate {Company_Name_Plate_Text}.

LOCALITY INFORMATION:
The locality is {Locality} with an address structure of G+{Address_Structure_G_Plus}. The building color is {Address_Structure_Color} and door color is {Door_Color}.

AREA ASSESSMENT:
Landmarks nearby: {Landmark_1} and {Landmark_2}. {Dominated_Area_Text}. {Feedback_from_Neighbour} feedback was received from neighbours. {Political_Connection_Text}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    ERT: `Office Remark: ENTRY RESTRICTED.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is locatable and rated as {Address_Rating}. At the time of visit, met with {Name_of_Met_Person} ({Met_Person_Type}), who informed that entry to the given premises is not allowed.

ENTRY RESTRICTION DETAILS:
{Name_of_Met_Person} {Met_Person_Confirmation} the office existence at the given address. Entry is restricted due to security protocols or company policies.

LOCALITY INFORMATION:
The locality is {Locality} with an address structure of G+{Address_Structure_G_Plus}. The building color is {Address_Structure_Color} and door color is {Door_Color}.

AREA ASSESSMENT:
Landmarks nearby: {Landmark_1} and {Landmark_2}. {Dominated_Area_Text}. {Feedback_from_Neighbour} feedback was received from neighbours. {Political_Connection_Text}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    UNTRACEABLE: `Office Remark: UNTRACEABLE.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is incorrect and untraceable.

CONTACT ATTEMPT:
We called {Customer_Name}, but {Call_Remark}. Proper guidance is required to trace the address.

SEARCH EFFORTS:
The locality type is {Locality}. Field executive reached up to the following landmarks: {Landmark_1}, {Landmark_2}, {Landmark_3}, {Landmark_4}. {Dominated_Area_Text}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    NSP_DOOR_OPEN: `Office Remark: NSP & DOOR OPEN (No Such Person).

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is locatable and rated as {Address_Rating}. At the time of visit, the office was {Office_Status}. Met with {Met_Person_Name} ({Designation}).

EMPLOYMENT VERIFICATION:
The met person informed that no such person is working at the given address. As per the current office staff, {Customer_Name} has never worked at this office.

OFFICE DETAILS:
Company nameplate {Company_Name_Plate_Text}. Office area is approximately {Office_Approx_Area}.

LOCALITY INFORMATION:
The locality is {Locality} with an address structure of G+{Address_Structure_G_Plus}. The building color is {Address_Structure_Color} and door color is {Door_Color}.

THIRD PARTY CONFIRMATION:
TPC was conducted with {Name_of_TPC_1} and {Name_of_TPC_2}, who confirmed that no such person is working at the given address.

AREA ASSESSMENT:
Landmarks nearby: {Landmark_1} and {Landmark_2}. {Dominated_Area_Text}. {Feedback_from_Neighbour} feedback was received from neighbours. {Customer_Name}'s employment is not confirmed by the field executive's observation or from TPC.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    NSP_DOOR_LOCKED: `Office Remark: NSP & DOOR LOCKED.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is locatable and rated as {Address_Rating}. At the time of visit, the office was closed.

THIRD PARTY CONFIRMATION:
TPC was conducted with {Name_of_TPC_1} and {Name_of_TPC_2}, who confirmed that the office exists at the given address but no such person ({Customer_Name}) is working there.

CURRENT OFFICE STATUS:
{Current_Company_Name} is currently operating at the given address. Company nameplate {Company_Name_Plate_Text}.

LOCALITY INFORMATION:
The locality is {Locality} with an address structure of G+{Address_Structure_G_Plus}. The building color is {Address_Structure_Color} and door color is {Door_Color}.

AREA ASSESSMENT:
Landmarks nearby: {Landmark_1} and {Landmark_2}. {Dominated_Area_Text}. {Feedback_from_Neighbour} feedback was received from neighbours. {Customer_Name}'s employment is not confirmed by the field executive's observation or from TPC.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,
  };

  private readonly BUSINESS_TEMPLATES = {
    POSITIVE_DOOR_OPEN: `Business Remark: POSITIVE & DOOR OPEN.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is locatable and rated as {Address_Rating}. At the time of visit, the business was {Business_Status}. Met with {Met_Person_Name} ({Designation}), who confirmed that {Customer_Name} has been running the business at the given address since the last {Business_Period}.

BUSINESS & ESTABLISHMENT DETAILS:
Business type is {Business_Type} ({Ownership_Type}) and the nature of business is {Company_Nature_Of_Business}. The business area is approximately {Business_Approx_Area}. Establishment period is {Establishment_Period}. Business owner: {Business_Owner_Name}. Company nameplate {Company_Name_Plate_Text}. Total staff strength is {Staff_Strength} and {Staff_Seen} were seen during the visit.

LOCALITY INFORMATION:
The locality is {Locality} with an address structure of G+{Address_Structure_G_Plus}. The building color is {Address_Structure_Color} and door color is {Door_Color}.

THIRD PARTY CONFIRMATION:
TPC was conducted with {Name_of_TPC_1}, who {TPC_Confirmation_1} {Customer_Name}'s business existence. Second TPC was done with {Name_of_TPC_2}, who also {TPC_Confirmation_2} the same.

AREA ASSESSMENT:
Landmarks nearby: {Landmark_1} and {Landmark_2}. {Dominated_Area_Text}. {Feedback_from_Neighbour} feedback was received regarding {Customer_Name} and the business. {Political_Connection_Text}. {Customer_Name}'s business stability is confirmed by the field executive's observation as well as from TPC.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    POSITIVE_DOOR_LOCKED: `Business Remark: POSITIVE & DOOR LOCKED.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is locatable and rated as {Address_Rating}. At the time of visit, the business was {Business_Status}.

THIRD PARTY CONFIRMATION:
TPC was conducted with {Name_of_TPC_1} and {Name_of_TPC_2}, who {TPC_Confirmation_1} {Customer_Name}'s business existence. They informed that the business has been operating at the given address since the last {Business_Period}.

BUSINESS & ESTABLISHMENT DETAILS:
Business type is {Business_Type} and the nature of business is {Company_Nature_Of_Business}. The business area is approximately {Business_Approx_Area}. Establishment period is {Establishment_Period}. Company nameplate {Company_Name_Plate_Text}.

LOCALITY INFORMATION:
The locality is {Locality} with an address structure of G+{Address_Structure_G_Plus}. The building color is {Address_Structure_Color} and door color is {Door_Color}.

AREA ASSESSMENT:
Landmarks nearby: {Landmark_1} and {Landmark_2}. {Dominated_Area_Text}. {Feedback_from_Neighbour} feedback was received from neighbours. {Political_Connection_Text}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    SHIFTED_DOOR_OPEN: `Business Remark: SHIFTED & DOOR OPEN.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is locatable and rated as {Address_Rating}. At the time of visit, the business was {Business_Status}. Met with {Met_Person_Name} ({Designation}), who confirmed that the business has shifted from the given address {Old_Business_Shifted_Period} ago.

CURRENT BUSINESS STATUS:
{Current_Company_Name} is currently operating at the given address since the last {Current_Company_Period}. Company nameplate {Company_Name_Plate_Text}.

LOCALITY INFORMATION:
The locality is {Locality} with an address structure of G+{Address_Structure_G_Plus}. The building color is {Address_Structure_Color} and door color is {Door_Color}.

THIRD PARTY CONFIRMATION:
TPC was conducted with {Name_of_TPC_1} and {Name_of_TPC_2}, who confirmed that the business has shifted from the given address.

AREA ASSESSMENT:
Landmarks nearby: {Landmark_1} and {Landmark_2}. {Dominated_Area_Text}. {Feedback_from_Neighbour} feedback was received from neighbours. {Political_Connection_Text}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    SHIFTED_DOOR_LOCKED: `Business Remark: SHIFTED & DOOR LOCKED.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is locatable and rated as {Address_Rating}. At the time of visit, the business was closed.

THIRD PARTY CONFIRMATION:
TPC was conducted with {Name_of_TPC_1} and {Name_of_TPC_2}, who confirmed that the business has shifted from the given address {Old_Business_Shifted_Period} ago.

CURRENT BUSINESS STATUS:
{Current_Company_Name} is currently operating at the given address. Company nameplate {Company_Name_Plate_Text}.

LOCALITY INFORMATION:
The locality is {Locality} with an address structure of G+{Address_Structure_G_Plus}. The building color is {Address_Structure_Color} and door color is {Door_Color}.

AREA ASSESSMENT:
Landmarks nearby: {Landmark_1} and {Landmark_2}. {Dominated_Area_Text}. {Feedback_from_Neighbour} feedback was received from neighbours. {Political_Connection_Text}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    NSP_DOOR_OPEN: `Business Remark: NSP & DOOR OPEN (No Such Person).

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is locatable and rated as {Address_Rating}. At the time of visit, the business was {Business_Status}. Met with {Met_Person_Name} ({Designation}).

BUSINESS VERIFICATION:
The met person informed that no such person is running a business at the given address. As per the current business owner, {Customer_Name} has never operated a business at this address.

CURRENT BUSINESS DETAILS:
Company nameplate {Company_Name_Plate_Text}. The business area is approximately {Business_Approx_Area}.

LOCALITY INFORMATION:
The locality is {Locality} with an address structure of G+{Address_Structure_G_Plus}. The building color is {Address_Structure_Color} and door color is {Door_Color}.

THIRD PARTY CONFIRMATION:
TPC was conducted with {Name_of_TPC_1} and {Name_of_TPC_2}, who confirmed that no such person is running a business at the given address.

AREA ASSESSMENT:
Landmarks nearby: {Landmark_1} and {Landmark_2}. {Dominated_Area_Text}. {Feedback_from_Neighbour} feedback was received from neighbours. {Customer_Name}'s business presence is not confirmed by the field executive's observation or from TPC.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    NSP_DOOR_LOCKED: `Business Remark: NSP & DOOR LOCKED.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is locatable and rated as {Address_Rating}. At the time of visit, the business was closed.

THIRD PARTY CONFIRMATION:
TPC was conducted with {Name_of_TPC_1} and {Name_of_TPC_2}, who confirmed that the business exists at the given address but no such person ({Customer_Name}) is running it.

CURRENT BUSINESS STATUS:
{Current_Company_Name} is currently operating at the given address. Company nameplate {Company_Name_Plate_Text}.

LOCALITY INFORMATION:
The locality is {Locality} with an address structure of G+{Address_Structure_G_Plus}. The building color is {Address_Structure_Color} and door color is {Door_Color}.

AREA ASSESSMENT:
Landmarks nearby: {Landmark_1} and {Landmark_2}. {Dominated_Area_Text}. {Feedback_from_Neighbour} feedback was received from neighbours. {Customer_Name}'s business presence is not confirmed by the field executive's observation or from TPC.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    ERT: `Business Remark: ENTRY RESTRICTED.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is locatable and rated as {Address_Rating}. At the time of visit, met with {Name_of_Met_Person} ({Met_Person_Type}), who informed that entry to the given premises is not allowed.

ENTRY RESTRICTION DETAILS:
{Name_of_Met_Person} {Met_Person_Confirmation} the business existence at the given address. Entry is restricted due to security protocols or business policies.

LOCALITY INFORMATION:
The locality is {Locality} with an address structure of G+{Address_Structure_G_Plus}. The building color is {Address_Structure_Color} and door color is {Door_Color}.

AREA ASSESSMENT:
Landmarks nearby: {Landmark_1} and {Landmark_2}. {Dominated_Area_Text}. {Feedback_from_Neighbour} feedback was received from neighbours. {Political_Connection_Text}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    UNTRACEABLE: `Business Remark: UNTRACEABLE.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is incorrect and untraceable.

CONTACT ATTEMPT:
We called {Customer_Name}, but {Call_Remark}. Proper guidance is required to trace the address.

SEARCH EFFORTS:
The locality type is {Locality}. Field executive reached up to the following landmarks: {Landmark_1}, {Landmark_2}, {Landmark_3}, {Landmark_4}. {Dominated_Area_Text}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,
  };

  private readonly RESIDENCE_CUM_OFFICE_TEMPLATES = {
    POSITIVE_DOOR_OPEN: `Residence-cum-Office Remark: POSITIVE & DOOR OPEN.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is locatable and rated as {Address_Rating}. At the time of visit, the residence was {House_Status} and the office was {Office_Status}. Met with {Met_Person_Name} ({Met_Person_Relation}), who confirmed {Customer_Name}'s stay and employment at the given address since the last {Staying_Period}.

RESIDENCE VERIFICATION:
{Customer_Name} has been staying at the given address since the last {Staying_Period} as {Staying_Status}. Total family members are {Total_Family_Members} and earning members are {Total_Earning_Members}.

OFFICE VERIFICATION:
{Customer_Name} has been working at the given address since the last {Working_Period} as {Applicant_Designation}. The office type is {Office_Type} and the nature of business is {Company_Nature_Of_Business}. Total staff strength is {Staff_Strength} and {Staff_Seen} were seen.

PROPERTY DETAILS:
Door nameplate {Door_Name_Plate_Text}. Society board {Society_Name_Plate_Text}. Company nameplate {Company_Name_Plate_Text}. During the visit, the met person showed {Document_Type} as identity proof.

LOCALITY INFORMATION:
The locality is {Locality} with an address structure of G+{Address_Structure_G_Plus}. The building color is {Address_Structure_Color} and door color is {Door_Color}.

THIRD PARTY CONFIRMATION:
TPC was conducted with {Name_of_TPC_1}, who {TPC_Confirmation_1} {Customer_Name}'s residence and office existence. Second TPC was done with {Name_of_TPC_2}, who also {TPC_Confirmation_2} the same.

AREA ASSESSMENT:
Landmarks nearby: {Landmark_1} and {Landmark_2}. {Dominated_Area_Text}. {Feedback_from_Neighbour} feedback was received from neighbours. {Political_Connection_Text}. {Customer_Name}'s residence and office stability is confirmed by the field executive's observation as well as from TPC.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    POSITIVE_DOOR_LOCKED: `Residence-cum-Office Remark: POSITIVE & DOOR LOCKED.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is locatable and rated as {Address_Rating}. At the time of visit, the residence and office were closed.

THIRD PARTY CONFIRMATION:
TPC was conducted with {Name_of_TPC_1} and {Name_of_TPC_2}, who {TPC_Confirmation_1} {Customer_Name}'s residence and office existence. They informed that {Customer_Name} has been staying and working at the given address since the last {Staying_Period}.

RESIDENCE & OFFICE DETAILS:
Total family members are {Total_Family_Members} and earning members are {Total_Earning_Members}.

PROPERTY DETAILS:
Door nameplate {Door_Name_Plate_Text}. Society board {Society_Name_Plate_Text}. Company nameplate {Company_Name_Plate_Text}.

LOCALITY INFORMATION:
The locality is {Locality} with an address structure of G+{Address_Structure_G_Plus}. The building color is {Address_Structure_Color} and door color is {Door_Color}.

AREA ASSESSMENT:
Landmarks nearby: {Landmark_1} and {Landmark_2}. {Dominated_Area_Text}. {Feedback_from_Neighbour} feedback was received from neighbours. {Political_Connection_Text}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    SHIFTED_DOOR_OPEN: `Residence-cum-Office Remark: SHIFTED & DOOR OPEN.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is locatable and rated as {Address_Rating}. At the time of visit, the residence was {House_Status} and the office was {Office_Status}. Met with {Met_Person_Name} ({Met_Person_Relation}), who confirmed that {Customer_Name} has shifted from the given address {Shifted_Period} ago.

CURRENT STATUS:
{Staying_Person_Name} is currently staying at the given address. {Current_Company_Name} office is operating at the given address since the last {Current_Company_Period}.

PROPERTY DETAILS:
Door nameplate {Door_Name_Plate_Text}. Society board {Society_Name_Plate_Text}. Company nameplate {Company_Name_Plate_Text}.

LOCALITY INFORMATION:
The locality is {Locality} with an address structure of G+{Address_Structure_G_Plus}. The building color is {Address_Structure_Color} and door color is {Door_Color}.

THIRD PARTY CONFIRMATION:
TPC was conducted with {Name_of_TPC_1} and {Name_of_TPC_2}, who confirmed that {Customer_Name} has shifted from the given address.

AREA ASSESSMENT:
Landmarks nearby: {Landmark_1} and {Landmark_2}. {Dominated_Area_Text}. {Feedback_from_Neighbour} feedback was received from neighbours. {Political_Connection_Text}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    SHIFTED_DOOR_LOCKED: `Residence-cum-Office Remark: SHIFTED & DOOR LOCKED.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is locatable and rated as {Address_Rating}. At the time of visit, the residence and office were closed.

THIRD PARTY CONFIRMATION:
TPC was conducted with {Name_of_TPC_1} and {Name_of_TPC_2}, who confirmed that {Customer_Name} has shifted from the given address {Shifted_Period} ago.

CURRENT STATUS:
{Staying_Person_Name} is currently staying at the given address. {Current_Company_Name} office is operating at the given address.

PROPERTY DETAILS:
Door nameplate {Door_Name_Plate_Text}. Society board {Society_Name_Plate_Text}. Company nameplate {Company_Name_Plate_Text}.

LOCALITY INFORMATION:
The locality is {Locality} with an address structure of G+{Address_Structure_G_Plus}. The building color is {Address_Structure_Color} and door color is {Door_Color}.

AREA ASSESSMENT:
Landmarks nearby: {Landmark_1} and {Landmark_2}. {Dominated_Area_Text}. {Feedback_from_Neighbour} feedback was received from neighbours. {Political_Connection_Text}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    NSP_DOOR_OPEN: `Residence-cum-Office Remark: NSP & DOOR OPEN (No Such Person).

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is locatable and rated as {Address_Rating}. At the time of visit, the residence was {House_Status} and the office was {Office_Status}. Met with {Met_Person_Name} ({Met_Person_Relation}).

RESIDENCE & OFFICE VERIFICATION:
The met person informed that no such person is staying or working at the given address. As per current residents and office staff, {Customer_Name} has never stayed or worked at this address.

CURRENT STATUS:
{Staying_Person_Name} is currently staying at the given address. Company nameplate {Company_Name_Plate_Text}.

LOCALITY INFORMATION:
The locality is {Locality} with an address structure of G+{Address_Structure_G_Plus}. The building color is {Address_Structure_Color} and door color is {Door_Color}.

THIRD PARTY CONFIRMATION:
TPC was conducted with {Name_of_TPC_1} and {Name_of_TPC_2}, who confirmed that no such person is staying or working at the given address.

AREA ASSESSMENT:
Landmarks nearby: {Landmark_1} and {Landmark_2}. {Dominated_Area_Text}. {Customer_Name}'s residence and office presence is not confirmed by the field executive's observation or from TPC.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    NSP_DOOR_LOCKED: `Residence-cum-Office Remark: NSP & DOOR LOCKED.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is locatable and rated as {Address_Rating}. At the time of visit, the residence and office were closed.

THIRD PARTY CONFIRMATION:
TPC was conducted with {Name_of_TPC_1} and {Name_of_TPC_2}, who confirmed that the residence and office exist at the given address but no such person ({Customer_Name}) is staying or working there.

CURRENT STATUS:
Current residents and office are operating at the given address. Company nameplate {Company_Name_Plate_Text}.

LOCALITY INFORMATION:
The locality is {Locality} with an address structure of G+{Address_Structure_G_Plus}. The building color is {Address_Structure_Color} and door color is {Door_Color}.

AREA ASSESSMENT:
Landmarks nearby: {Landmark_1} and {Landmark_2}. {Dominated_Area_Text}. {Customer_Name}'s residence and office presence is not confirmed by the field executive's observation or from TPC.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    ERT: `Residence-cum-Office Remark: ENTRY RESTRICTED.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is locatable and rated as {Address_Rating}. At the time of visit, met with {Name_of_Met_Person} ({Met_Person_Type}), who informed that entry to the given premises is not allowed.

ENTRY RESTRICTION DETAILS:
{Name_of_Met_Person} {Met_Person_Confirmation} the residence and office existence at the given address. Entry is restricted due to security protocols or building policies.

LOCALITY INFORMATION:
The locality is {Locality} with an address structure of G+{Address_Structure_G_Plus}. The building color is {Address_Structure_Color} and door color is {Door_Color}.

AREA ASSESSMENT:
Landmarks nearby: {Landmark_1} and {Landmark_2}. {Dominated_Area_Text}. {Feedback_from_Neighbour} feedback was received from neighbours. {Political_Connection_Text}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    UNTRACEABLE: `Residence-cum-Office Remark: UNTRACEABLE.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is incorrect and untraceable.

CONTACT ATTEMPT:
We called {Customer_Name}, but {Call_Remark}. Proper guidance is required to trace the address.

SEARCH EFFORTS:
The locality type is {Locality}. Field executive reached up to the following landmarks: {Landmark_1}, {Landmark_2}, {Landmark_3}, {Landmark_4}. {Dominated_Area_Text}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,
  };

  private readonly BUILDER_TEMPLATES = {
    POSITIVE_DOOR_OPEN: `Builder Remark: POSITIVE & DOOR OPEN.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is locatable and rated as {Address_Rating}. At the time of visit, the builder office was {Office_Status}. Met with {Met_Person_Name} ({Designation}), who confirmed that {Customer_Name} has been working as a builder at the given address since the last {Working_Period}.

BUILDER & OFFICE DETAILS:
Builder type is {Builder_Type} and the nature of business is {Company_Nature_Of_Business}. Office area is approximately {Office_Approx_Area}. Establishment period is {Establishment_Period}. Builder name: {Builder_Name}. Total staff strength is {Staff_Strength} and {Staff_Seen} were seen. Company nameplate {Company_Name_Plate_Text}.

LOCALITY INFORMATION:
The locality is {Locality} with an address structure of G+{Address_Structure_G_Plus}. The building color is {Address_Structure_Color} and door color is {Door_Color}.

THIRD PARTY CONFIRMATION:
TPC was conducted with {Name_of_TPC_1}, who {TPC_Confirmation_1} {Customer_Name}'s builder office existence. Second TPC was done with {Name_of_TPC_2}, who also {TPC_Confirmation_2} the same.

AREA ASSESSMENT:
Landmarks nearby: {Landmark_1} and {Landmark_2}. {Dominated_Area_Text}. {Feedback_from_Neighbour} feedback was received regarding {Customer_Name} and the builder firm. {Political_Connection_Text}. {Customer_Name}'s builder office stability is confirmed by the field executive's observation as well as from TPC.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    POSITIVE_DOOR_LOCKED: `Builder Remark: POSITIVE & DOOR LOCKED.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is locatable and rated as {Address_Rating}. At the time of visit, the builder office was {Office_Status}.

THIRD PARTY CONFIRMATION:
TPC was conducted with {Name_of_TPC_1} and {Name_of_TPC_2}, who {TPC_Confirmation_1} {Customer_Name}'s builder office existence. They informed that the builder has been operating at the given address since the last {Working_Period}.

BUILDER & OFFICE DETAILS:
Builder type is {Builder_Type} and the nature of business is {Company_Nature_Of_Business}. Office area is approximately {Office_Approx_Area}. Company nameplate {Company_Name_Plate_Text}.

LOCALITY INFORMATION:
The locality is {Locality} with an address structure of G+{Address_Structure_G_Plus}. The building color is {Address_Structure_Color} and door color is {Door_Color}.

AREA ASSESSMENT:
Landmarks nearby: {Landmark_1} and {Landmark_2}. {Dominated_Area_Text}. {Feedback_from_Neighbour} feedback was received from neighbours. {Political_Connection_Text}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    SHIFTED_DOOR_OPEN: `Builder Remark: SHIFTED & DOOR OPEN.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is locatable and rated as {Address_Rating}. At the time of visit, the builder office was {Office_Status}. Met with {Met_Person_Name} ({Designation}), who confirmed that the builder office has shifted from the given address {Old_Office_Shifted_Period} ago.

CURRENT OFFICE STATUS:
{Current_Company_Name} is currently operating at the given address since the last {Current_Company_Period}. Company nameplate {Company_Name_Plate_Text}.

LOCALITY INFORMATION:
The locality is {Locality} with an address structure of G+{Address_Structure_G_Plus}. The building color is {Address_Structure_Color} and door color is {Door_Color}.

THIRD PARTY CONFIRMATION:
TPC was conducted with {Name_of_TPC_1} and {Name_of_TPC_2}, who confirmed that the builder office has shifted from the given address.

AREA ASSESSMENT:
Landmarks nearby: {Landmark_1} and {Landmark_2}. {Dominated_Area_Text}. {Feedback_from_Neighbour} feedback was received from neighbours. {Political_Connection_Text}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    SHIFTED_DOOR_LOCKED: `Builder Remark: SHIFTED & DOOR LOCKED.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is locatable and rated as {Address_Rating}. At the time of visit, the builder office was closed.

THIRD PARTY CONFIRMATION:
TPC was conducted with {Name_of_TPC_1} and {Name_of_TPC_2}, who confirmed that the builder office has shifted from the given address {Old_Office_Shifted_Period} ago.

CURRENT OFFICE STATUS:
{Current_Company_Name} is currently operating at the given address. Company nameplate {Company_Name_Plate_Text}.

LOCALITY INFORMATION:
The locality is {Locality} with an address structure of G+{Address_Structure_G_Plus}. The building color is {Address_Structure_Color} and door color is {Door_Color}.

AREA ASSESSMENT:
Landmarks nearby: {Landmark_1} and {Landmark_2}. {Dominated_Area_Text}. {Feedback_from_Neighbour} feedback was received from neighbours. {Political_Connection_Text}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    NSP_DOOR_OPEN: `Builder Remark: NSP & DOOR OPEN (No Such Person).

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is locatable and rated as {Address_Rating}. At the time of visit, the builder office was {Office_Status}. Met with {Met_Person_Name} ({Designation}).

BUILDER VERIFICATION:
The met person informed that no such person is working as a builder at the given address. As per the current office staff, {Customer_Name} has never worked as a builder at this office.

CURRENT OFFICE DETAILS:
Company nameplate {Company_Name_Plate_Text}. Office area is approximately {Office_Approx_Area}.

LOCALITY INFORMATION:
The locality is {Locality} with an address structure of G+{Address_Structure_G_Plus}. The building color is {Address_Structure_Color} and door color is {Door_Color}.

THIRD PARTY CONFIRMATION:
TPC was conducted with {Name_of_TPC_1} and {Name_of_TPC_2}, who confirmed that no such person is working as a builder at the given address.

AREA ASSESSMENT:
Landmarks nearby: {Landmark_1} and {Landmark_2}. {Dominated_Area_Text}. {Feedback_from_Neighbour} feedback was received from neighbours. {Customer_Name}'s builder presence is not confirmed by the field executive's observation or from TPC.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    NSP_DOOR_LOCKED: `Builder Remark: NSP & DOOR LOCKED.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is locatable and rated as {Address_Rating}. At the time of visit, the builder office was closed.

THIRD PARTY CONFIRMATION:
TPC was conducted with {Name_of_TPC_1} and {Name_of_TPC_2}, who confirmed that the builder office exists at the given address but no such person ({Customer_Name}) is working there as a builder.

CURRENT OFFICE STATUS:
{Current_Company_Name} is currently operating at the given address. Company nameplate {Company_Name_Plate_Text}.

LOCALITY INFORMATION:
The locality is {Locality} with an address structure of G+{Address_Structure_G_Plus}. The building color is {Address_Structure_Color} and door color is {Door_Color}.

AREA ASSESSMENT:
Landmarks nearby: {Landmark_1} and {Landmark_2}. {Dominated_Area_Text}. {Feedback_from_Neighbour} feedback was received from neighbours. {Customer_Name}'s builder presence is not confirmed by the field executive's observation or from TPC.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    ERT: `Builder Remark: ENTRY RESTRICTED.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is locatable and rated as {Address_Rating}. At the time of visit, met with {Name_of_Met_Person} ({Met_Person_Type}), who informed that entry to the given premises is not allowed.

ENTRY RESTRICTION DETAILS:
{Name_of_Met_Person} {Met_Person_Confirmation} the builder office existence at the given address. Entry is restricted due to security protocols or office policies.

LOCALITY INFORMATION:
The locality is {Locality} with an address structure of G+{Address_Structure_G_Plus}. The building color is {Address_Structure_Color} and door color is {Door_Color}.

AREA ASSESSMENT:
Landmarks nearby: {Landmark_1} and {Landmark_2}. {Dominated_Area_Text}. {Feedback_from_Neighbour} feedback was received from neighbours. {Political_Connection_Text}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    UNTRACEABLE: `Builder Remark: UNTRACEABLE.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is incorrect and untraceable.

CONTACT ATTEMPT:
We called {Customer_Name}, but {Call_Remark}. Proper guidance is required to trace the address.

SEARCH EFFORTS:
The locality type is {Locality}. Field executive reached up to the following landmarks: {Landmark_1}, {Landmark_2}, {Landmark_3}, {Landmark_4}. {Dominated_Area_Text}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,
  };

  private readonly NOC_TEMPLATES = {
    POSITIVE_DOOR_OPEN: `NOC Remark: POSITIVE & DOOR OPEN.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is locatable and rated as {Address_Rating}. At the time of visit, the NOC office was accessible. Met with {Met_Person_Name} ({Designation}), who confirmed {Customer_Name}'s NOC verification is positive.

NOC VERIFICATION DETAILS:
NOC Type: {NOC_Type}. NOC Number: {NOC_Number}. Issued by {NOC_Issuing_Authority} on {NOC_Issue_Date}, valid until {NOC_Expiry_Date}. NOC validity status: {NOC_Validity_Status}. Project: {Project_Name} ({Project_Status}). Total units: {Total_Units}, completed: {Completed_Units}, sold: {Sold_Units}. Builder: {Builder_Name} (RERA: {Builder_Registration_Number}).

CLEARANCES:
Environmental: {Environmental_Clearance}. Fire Safety: {Fire_Safety_Clearance}. Pollution: {Pollution_Clearance}. Water: {Water_Connection_Status}. Electricity: {Electricity_Connection_Status}.

LOCALITY INFORMATION:
The locality is {Locality} with an address structure of G+{Address_Structure_G_Plus}. The building color is {Address_Structure_Color} and door color is {Door_Color}.

THIRD PARTY CONFIRMATION:
TPC was conducted with {Name_of_TPC_1}, who {TPC_Confirmation_1} the NOC details. Second TPC was done with {Name_of_TPC_2}, who also {TPC_Confirmation_2} the same.

AREA ASSESSMENT:
Landmarks nearby: {Landmark_1} and {Landmark_2}. {Dominated_Area_Text}. {Feedback_from_Neighbour} feedback was received from neighbours. {Political_Connection_Text}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    POSITIVE_DOOR_LOCKED: `NOC Remark: POSITIVE & DOOR LOCKED.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is locatable and rated as {Address_Rating}. At the time of visit, the NOC office was closed.

THIRD PARTY CONFIRMATION:
TPC was conducted with {Name_of_TPC_1} and {Name_of_TPC_2}, who {TPC_Confirmation_1} the NOC verification details and confirmed all documents are valid.

NOC VERIFICATION DETAILS:
NOC Type: {NOC_Type}. NOC Number: {NOC_Number}. Issued by {NOC_Issuing_Authority}. NOC validity status: {NOC_Validity_Status}. Project: {Project_Name}. Builder: {Builder_Name}.

LOCALITY INFORMATION:
The locality is {Locality} with an address structure of G+{Address_Structure_G_Plus}. The building color is {Address_Structure_Color} and door color is {Door_Color}.

AREA ASSESSMENT:
Landmarks nearby: {Landmark_1} and {Landmark_2}. {Dominated_Area_Text}. {Feedback_from_Neighbour} feedback was received from neighbours. {Political_Connection_Text}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    SHIFTED_DOOR_OPEN: `NOC Remark: SHIFTED & DOOR OPEN.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is locatable and rated as {Address_Rating}. Met with {Met_Person_Name} ({Designation}), who informed that the NOC office has shifted from the given address {Shifted_Period} ago.

CURRENT STATUS:
The premises status is {Premises_Status}. The current location is {Current_Location}.

LOCALITY INFORMATION:
The locality is {Locality} with an address structure of G+{Address_Structure_G_Plus}. The building color is {Address_Structure_Color} and door color is {Door_Color}.

THIRD PARTY CONFIRMATION:
TPC was conducted with {Name_of_TPC_1} and {Name_of_TPC_2}, who confirmed that the NOC office has shifted from the given address.

AREA ASSESSMENT:
Landmarks nearby: {Landmark_1} and {Landmark_2}. {Dominated_Area_Text}. {Feedback_from_Neighbour} feedback was received from neighbours. {Political_Connection_Text}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    SHIFTED_DOOR_LOCKED: `NOC Remark: SHIFTED & DOOR LOCKED.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is locatable and rated as {Address_Rating}. At the time of visit, the premises were closed.

THIRD PARTY CONFIRMATION:
TPC was conducted with {Name_of_TPC_1} and {Name_of_TPC_2}, who confirmed that the NOC office has shifted from the given address {Shifted_Period} ago. The premises status is {Premises_Status}.

LOCALITY INFORMATION:
The locality is {Locality} with an address structure of G+{Address_Structure_G_Plus}. The building color is {Address_Structure_Color} and door color is {Door_Color}.

AREA ASSESSMENT:
Landmarks nearby: {Landmark_1} and {Landmark_2}. {Dominated_Area_Text}. {Feedback_from_Neighbour} feedback was received from neighbours. {Political_Connection_Text}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    NSP_DOOR_OPEN: `NOC Remark: NSP & DOOR OPEN (No Such Person).

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is locatable and rated as {Address_Rating}. Met with {Met_Person_Name} ({Designation}), who informed that no such person is associated with the NOC at the given address.

NOC VERIFICATION:
As per the met person, {Customer_Name} has no connection with the NOC or the project at this address.

LOCALITY INFORMATION:
The locality is {Locality} with an address structure of G+{Address_Structure_G_Plus}. The building color is {Address_Structure_Color} and door color is {Door_Color}.

THIRD PARTY CONFIRMATION:
TPC was conducted with {Name_of_TPC_1} and {Name_of_TPC_2}, who confirmed that no such person ({Customer_Name}) is associated with the NOC at the given address.

AREA ASSESSMENT:
Landmarks nearby: {Landmark_1} and {Landmark_2}. {Dominated_Area_Text}. {Customer_Name}'s association with the NOC is not confirmed by the field executive's observation or from TPC.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    NSP_DOOR_LOCKED: `NOC Remark: NSP & DOOR LOCKED.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is locatable and rated as {Address_Rating}. At the time of visit, the premises were closed.

THIRD PARTY CONFIRMATION:
TPC was conducted with {Name_of_TPC_1} and {Name_of_TPC_2}, who confirmed that the NOC office exists at the given address but no such person ({Customer_Name}) is associated with it.

LOCALITY INFORMATION:
The locality is {Locality} with an address structure of G+{Address_Structure_G_Plus}. The building color is {Address_Structure_Color} and door color is {Door_Color}.

AREA ASSESSMENT:
Landmarks nearby: {Landmark_1} and {Landmark_2}. {Dominated_Area_Text}. {Customer_Name}'s association with the NOC is not confirmed by the field executive's observation or from TPC.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    ERT: `NOC Remark: ENTRY RESTRICTED.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is locatable and rated as {Address_Rating}. At the time of visit, met with {Name_of_Met_Person} ({Met_Person_Type}), who informed that entry to the given premises is not allowed.

ENTRY RESTRICTION DETAILS:
{Name_of_Met_Person} {Met_Person_Confirmation} the NOC office existence at the given address. Entry is restricted due to security protocols or office policies.

LOCALITY INFORMATION:
The locality is {Locality} with an address structure of G+{Address_Structure_G_Plus}. The building color is {Address_Structure_Color} and door color is {Door_Color}.

AREA ASSESSMENT:
Landmarks nearby: {Landmark_1} and {Landmark_2}. {Dominated_Area_Text}. {Feedback_from_Neighbour} feedback was received from neighbours. {Political_Connection_Text}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    UNTRACEABLE: `NOC Remark: UNTRACEABLE.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is incorrect and untraceable.

CONTACT ATTEMPT:
We called {Customer_Name}, but {Call_Remark}. Proper guidance is required to trace the address.

SEARCH EFFORTS:
The locality type is {Locality}. Field executive reached up to the following landmarks: {Landmark_1}, {Landmark_2}, {Landmark_3}, {Landmark_4}. {Dominated_Area_Text}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,
  };

  private readonly DSA_CONNECTOR_TEMPLATES = {
    POSITIVE_DOOR_OPEN: `DSA/Connector Remark: POSITIVE & DOOR OPEN.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is locatable and rated as {Address_Rating}. At the time of visit, the DSA/Connector office was operational. Met with {Met_Person_Name} ({Met_Person_Designation}), who confirmed {Customer_Name}'s DSA/Connector operations at the given address.

DSA/CONNECTOR DETAILS:
Connector Type: {Connector_Type}. Connector Name: {Connector_Name} (Code: {Connector_Code}). Experience: {Connector_Experience} years. Status: {Connector_Status}. Business: {Business_Name} ({Business_Type}). Registration: {Business_Registration_Number}. Established: {Business_Establishment_Year}. Annual turnover: {Annual_Turnover}. Total staff: {Total_Staff} (Sales: {Sales_Staff}, Support: {Support_Staff}). Office type: {Office_Type}, area: {Office_Area} sq ft.

COMPLIANCE & LICENSING:
License: {License_Number} ({License_Status}), expires {License_Expiry_Date}. Compliance: {Compliance_Status}. Audit: {Audit_Status}. Training: {Training_Status}.

LOCALITY INFORMATION:
The locality is {Locality} with an address structure of G+{Address_Structure_G_Plus}. The building color is {Address_Structure_Color} and door color is {Door_Color}.

THIRD PARTY CONFIRMATION:
TPC was conducted with {Name_of_TPC_1}, who {TPC_Confirmation_1} {Customer_Name}'s DSA/Connector office existence. Second TPC was done with {Name_of_TPC_2}, who also {TPC_Confirmation_2} the same.

MARKET & RISK ASSESSMENT:
Market presence: {Market_Presence}. Market reputation: {Market_Reputation}. Customer feedback: {Customer_Feedback}. Risk assessment: {Risk_Assessment}. Landmarks nearby: {Landmark_1} and {Landmark_2}. {Dominated_Area_Text}. {Feedback_from_Neighbour} feedback was received. {Political_Connection_Text}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    POSITIVE_DOOR_LOCKED: `DSA/Connector Remark: POSITIVE & DOOR LOCKED.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is locatable and rated as {Address_Rating}. At the time of visit, the DSA/Connector office was closed.

THIRD PARTY CONFIRMATION:
TPC was conducted with {Name_of_TPC_1} and {Name_of_TPC_2}, who {TPC_Confirmation_1} {Customer_Name}'s DSA/Connector office existence and operations.

DSA/CONNECTOR DETAILS:
Connector: {Connector_Name} ({Connector_Type}). Business: {Business_Name}. Status: {Connector_Status}. Annual turnover: {Annual_Turnover}.

LOCALITY INFORMATION:
The locality is {Locality} with an address structure of G+{Address_Structure_G_Plus}. The building color is {Address_Structure_Color} and door color is {Door_Color}.

AREA ASSESSMENT:
Landmarks nearby: {Landmark_1} and {Landmark_2}. {Dominated_Area_Text}. {Feedback_from_Neighbour} feedback was received from neighbours. {Political_Connection_Text}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    SHIFTED_DOOR_OPEN: `DSA/Connector Remark: SHIFTED & DOOR OPEN.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is locatable and rated as {Address_Rating}. Met with {Met_Person_Name} ({Met_Person_Designation}), who informed that the DSA/Connector office has shifted from the given address {Shifted_Period} ago.

CURRENT STATUS:
Previous business: {Previous_Business_Name}. The premises status is {Premises_Status}. Current location: {Current_Location}.

LOCALITY INFORMATION:
The locality is {Locality} with an address structure of G+{Address_Structure_G_Plus}. The building color is {Address_Structure_Color} and door color is {Door_Color}.

THIRD PARTY CONFIRMATION:
TPC was conducted with {Name_of_TPC_1} and {Name_of_TPC_2}, who confirmed that the DSA/Connector office has shifted from the given address.

AREA ASSESSMENT:
Landmarks nearby: {Landmark_1} and {Landmark_2}. {Dominated_Area_Text}. {Feedback_from_Neighbour} feedback was received from neighbours. {Political_Connection_Text}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    SHIFTED_DOOR_LOCKED: `DSA/Connector Remark: SHIFTED & DOOR LOCKED.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is locatable and rated as {Address_Rating}. At the time of visit, the DSA/Connector office was closed.

THIRD PARTY CONFIRMATION:
TPC was conducted with {Name_of_TPC_1} and {Name_of_TPC_2}, who confirmed that the DSA/Connector office has shifted from the given address {Shifted_Period} ago.

CURRENT STATUS:
Previous business: {Previous_Business_Name}. The premises status is {Premises_Status}.

LOCALITY INFORMATION:
The locality is {Locality} with an address structure of G+{Address_Structure_G_Plus}. The building color is {Address_Structure_Color} and door color is {Door_Color}.

AREA ASSESSMENT:
Landmarks nearby: {Landmark_1} and {Landmark_2}. {Dominated_Area_Text}. {Feedback_from_Neighbour} feedback was received from neighbours. {Political_Connection_Text}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    NSP_DOOR_OPEN: `DSA/Connector Remark: NSP & DOOR OPEN (No Such Person).

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is locatable and rated as {Address_Rating}. Met with {Met_Person_Name} ({Met_Person_Designation}).

DSA/CONNECTOR VERIFICATION:
The met person informed that no such person is operating as a DSA/Connector at the given address. As per the current office staff, {Customer_Name} has never worked as a DSA/Connector at this location.

LOCALITY INFORMATION:
The locality is {Locality} with an address structure of G+{Address_Structure_G_Plus}. The building color is {Address_Structure_Color} and door color is {Door_Color}.

THIRD PARTY CONFIRMATION:
TPC was conducted with {Name_of_TPC_1} and {Name_of_TPC_2}, who confirmed that no such person is operating as a DSA/Connector at the given address.

AREA ASSESSMENT:
Landmarks nearby: {Landmark_1} and {Landmark_2}. {Dominated_Area_Text}. {Customer_Name}'s DSA/Connector presence is not confirmed by the field executive's observation or from TPC.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    NSP_DOOR_LOCKED: `DSA/Connector Remark: NSP & DOOR LOCKED.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is locatable and rated as {Address_Rating}. At the time of visit, the DSA/Connector office was closed.

THIRD PARTY CONFIRMATION:
TPC was conducted with {Name_of_TPC_1} and {Name_of_TPC_2}, who confirmed that the DSA/Connector office exists at the given address but no such person ({Customer_Name}) is operating there.

LOCALITY INFORMATION:
The locality is {Locality} with an address structure of G+{Address_Structure_G_Plus}. The building color is {Address_Structure_Color} and door color is {Door_Color}.

AREA ASSESSMENT:
Landmarks nearby: {Landmark_1} and {Landmark_2}. {Dominated_Area_Text}. {Customer_Name}'s DSA/Connector presence is not confirmed by the field executive's observation or from TPC.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    ERT: `DSA/Connector Remark: ENTRY RESTRICTED.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is locatable and rated as {Address_Rating}. At the time of visit, met with {Name_of_Met_Person} ({Met_Person_Type}), who informed that entry to the given premises is not allowed.

ENTRY RESTRICTION DETAILS:
{Name_of_Met_Person} {Met_Person_Confirmation} the DSA/Connector office existence at the given address. Entry is restricted due to security protocols or office policies.

LOCALITY INFORMATION:
The locality is {Locality} with an address structure of G+{Address_Structure_G_Plus}. The building color is {Address_Structure_Color} and door color is {Door_Color}.

AREA ASSESSMENT:
Landmarks nearby: {Landmark_1} and {Landmark_2}. {Dominated_Area_Text}. {Feedback_from_Neighbour} feedback was received from neighbours. {Political_Connection_Text}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    UNTRACEABLE: `DSA/Connector Remark: UNTRACEABLE.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is incorrect and untraceable.

CONTACT ATTEMPT:
We called {Customer_Name}, but {Call_Remark}. Proper guidance is required to trace the address.

SEARCH EFFORTS:
The locality type is {Locality}. Field executive reached up to the following landmarks: {Landmark_1}, {Landmark_2}, {Landmark_3}, {Landmark_4}. {Dominated_Area_Text}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,
  };

  private readonly PROPERTY_APF_TEMPLATES: Record<string, string> = {
    POSITIVE: `Property APF Remark: POSITIVE.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is locatable and rated as {Address_Rating}. At the time of visit, the property was {Property_Status}. Met with {Met_Person_Name} ({Met_Person_Designation}), who confirmed {Customer_Name}'s property at the given address.

PROPERTY DETAILS:
Property type is {Property_Type} with {Property_Ownership} ownership. Property area is approximately {Property_Area}. Property age is {Property_Age} and condition is {Property_Condition}. Market value is {Market_Value}. Building status is {Building_Status} with construction activity: {Construction_Activity}.

APF DETAILS:
APF number is {APF_Number} with status {APF_Status}, issued by {APF_Issuing_Authority}. APF amount is {APF_Amount}, utilized amount is {APF_Utilized_Amount}, and balance amount is {APF_Balance_Amount}. APF validity status is {APF_Validity_Status}.

PROJECT INFORMATION:
Project name is {Project_Name} with status {Project_Status}. Approval status is {Project_Approval_Status} with {Project_Completion_Percentage}% completion. Total units: {Total_Units}, completed: {Completed_Units}, sold: {Sold_Units}, available: {Available_Units}. Possession status is {Possession_Status}. Staff strength is {Staff_Strength} with {Staff_Seen} staff seen. Builder/Developer is {Builder_Name} (RERA: {Builder_Registration_Number}).

LEGAL STATUS:
Legal clearance: {Legal_Clearance}. Title clearance: {Title_Clearance}. Encumbrance status: {Encumbrance_Status}. Litigation status: {Litigation_Status}.

LOCALITY INFORMATION:
The locality is {Locality} with an address structure of G+{Address_Structure_G_Plus}. The building color is {Address_Structure_Color} and door color is {Door_Color}.

THIRD PARTY CONFIRMATION:
TPC done with {TPC_Met_Person_1} {Name_of_TPC_1} who {TPC_Confirmation_1} and {TPC_Met_Person_2} {Name_of_TPC_2} who {TPC_Confirmation_2} the property existence and APF compliance at the given address.

AREA ASSESSMENT:
Landmarks nearby: {Landmark_1} and {Landmark_2}. {Dominated_Area_Text}. {Feedback_From_Neighbour} feedback received from neighbours regarding the property. {Political_Connection_Text}. Infrastructure status: {Infrastructure_Status}. Road connectivity: {Road_Connectivity}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    NEGATIVE: `Property APF Remark: NEGATIVE.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is locatable and rated as {Address_Rating}. Property verification was conducted for APF assessment.

PROPERTY DETAILS:
Property type is {Property_Type} with {Property_Ownership} ownership. Property area is approximately {Property_Area}. Property condition is {Property_Condition}. Market value is {Market_Value}. Building status is {Building_Status}.

APF DETAILS:
APF number is {APF_Number} with status {APF_Status}. APF amount is {APF_Amount}. APF validity status is {APF_Validity_Status}.

PROJECT INFORMATION:
Project name is {Project_Name} with status {Project_Status}. Builder/Developer is {Builder_Name} (RERA: {Builder_Registration_Number}).

LOCALITY INFORMATION:
The locality is {Locality} with an address structure of G+{Address_Structure_G_Plus}. The building color is {Address_Structure_Color} and door color is {Door_Color}.

THIRD PARTY CONFIRMATION:
TPC done with {TPC_Met_Person_1} {Name_of_TPC_1} who {TPC_Confirmation_1} and {TPC_Met_Person_2} {Name_of_TPC_2} who {TPC_Confirmation_2}.

AREA ASSESSMENT:
Landmarks nearby: {Landmark_1} and {Landmark_2}. {Dominated_Area_Text}. {Feedback_From_Neighbour} feedback received from neighbours. {Political_Connection_Text}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    ERT: `Property APF Remark: ENTRY RESTRICTED.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is locatable and rated as {Address_Rating}. At the time of visit, met with {Security_Person_Name} who informed that entry to the given premises is not allowed.

ENTRY RESTRICTION DETAILS:
{Security_Person_Name} {Security_Confirmation} the property/APF existence at the given address. Entry is restricted due to: {Entry_Restriction_Reason}.

LOCALITY INFORMATION:
The locality is {Locality} with an address structure of G+{Address_Structure_G_Plus}. The building color is {Address_Structure_Color} and door color is {Door_Color}.

AREA ASSESSMENT:
Landmarks nearby: {Landmark_1} and {Landmark_2}. {Dominated_Area_Text}. {Feedback_From_Neighbour} feedback received from neighbours. {Political_Connection_Text}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    UNTRACEABLE: `Property APF Remark: UNTRACEABLE.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is incorrect and untraceable.

CONTACT ATTEMPT:
We called {Customer_Name}, but {Call_Remark}. Proper guidance is required to trace the property address.

SEARCH EFFORTS:
The locality type is {Locality}. Field executive reached up to the following landmarks: {Landmark_1}, {Landmark_2}, {Landmark_3}, {Landmark_4}. {Dominated_Area_Text}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,
  };

  private readonly PROPERTY_INDIVIDUAL_TEMPLATES: Record<string, string> = {
    POSITIVE_DOOR_OPEN: `Property Individual Remark: POSITIVE & DOOR OPEN.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is locatable and rated as {Address_Rating}. At the time of visit, the property was {Property_Status}. Met with {Met_Person_Name} ({Met_Person_Relation}), who confirmed {Customer_Name}'s property ownership at the given address since last {Property_Age}.

PROPERTY OWNERSHIP DETAILS:
Property type is {Property_Type} with {Ownership_Status} ownership. Property area is approximately {Approx_Area_Sq_Feet}. Property age is {Property_Age}.

LOCALITY INFORMATION:
The locality is {Locality} with an address structure of G+{Address_Structure_G_Plus}. The building color is {Address_Structure_Color} and door color is {Door_Color}.

THIRD PARTY CONFIRMATION:
TPC done with {TPC_Met_Person_1} {Name_of_TPC_1} who {TPC_Confirmation_1} and {TPC_Met_Person_2} {Name_of_TPC_2} who {TPC_Confirmation_2} {Customer_Name}'s property ownership at the given address.

AREA ASSESSMENT:
Landmarks nearby: {Landmark_1} and {Landmark_2}. {Dominated_Area_Text}. {Feedback_From_Neighbour} feedback received from neighbours regarding {Customer_Name} and the property. {Political_Connection_Text}. {Customer_Name}'s property ownership is confirmed by the field executive's observation as well as from TPC.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    POSITIVE_DOOR_LOCKED: `Property Individual Remark: POSITIVE & DOOR LOCKED.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is locatable and rated as {Address_Rating}. At the time of visit, the property was locked/inaccessible.

THIRD PARTY CONFIRMATION:
TPC done with {TPC_Met_Person_1} {Name_of_TPC_1} who {TPC_Confirmation_1} and {TPC_Met_Person_2} {Name_of_TPC_2} who {TPC_Confirmation_2} {Customer_Name}'s property ownership. They informed that the property is owned by {Customer_Name} at the given address since last {Property_Age}.

PROPERTY OWNERSHIP DETAILS:
Property type is {Property_Type} with {Ownership_Status} ownership. Property area is approximately {Approx_Area_Sq_Feet}.

LOCALITY INFORMATION:
The locality is {Locality} with an address structure of G+{Address_Structure_G_Plus}. The building color is {Address_Structure_Color} and door color is {Door_Color}.

AREA ASSESSMENT:
Landmarks nearby: {Landmark_1} and {Landmark_2}. {Dominated_Area_Text}. {Feedback_From_Neighbour} feedback received from neighbours. {Political_Connection_Text}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    NSP_DOOR_OPEN: `Property Individual Remark: NSP & DOOR OPEN (No Such Person).

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is locatable and rated as {Address_Rating}. At the time of visit, the property was {Property_Status}. Met with {Met_Person_Name} ({Met_Person_Relation}).

PROPERTY VERIFICATION:
Met person informed that there is no such person owning property at the given address. As per current property owner, {Customer_Name} has never owned property at this address.

PROPERTY DETAILS:
Property type is {Property_Type}. Property area is approximately {Approx_Area_Sq_Feet}.

LOCALITY INFORMATION:
The locality is {Locality} with an address structure of G+{Address_Structure_G_Plus}. The building color is {Address_Structure_Color} and door color is {Door_Color}.

THIRD PARTY CONFIRMATION:
TPC done with {TPC_Met_Person_1} {Name_of_TPC_1} and {TPC_Met_Person_2} {Name_of_TPC_2}, who confirmed that there is no such person owning property at the given address.

AREA ASSESSMENT:
Landmarks nearby: {Landmark_1} and {Landmark_2}. {Dominated_Area_Text}. {Feedback_From_Neighbour} feedback received from neighbours. {Customer_Name}'s property ownership is not confirmed by the field executive's observation or from TPC.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    NSP_DOOR_LOCKED: `Property Individual Remark: NSP & DOOR LOCKED.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is locatable and rated as {Address_Rating}. At the time of visit, the property was locked/inaccessible.

THIRD PARTY CONFIRMATION:
TPC done with {TPC_Met_Person_1} {Name_of_TPC_1} who {TPC_Confirmation_1} and {TPC_Met_Person_2} {Name_of_TPC_2} who {TPC_Confirmation_2}. As per TPC confirmation, there is no such person owning property at this address.

LOCALITY INFORMATION:
The locality is {Locality} with an address structure of G+{Address_Structure_G_Plus}. The building color is {Address_Structure_Color} and door color is {Door_Color}.

AREA ASSESSMENT:
Landmarks nearby: {Landmark_1} and {Landmark_2}. {Dominated_Area_Text}. {Feedback_From_Neighbour} feedback received from neighbours. {Customer_Name}'s property ownership is not confirmed by the field executive's observation or from TPC.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    ERT: `Property Individual Remark: ENTRY RESTRICTED.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is locatable and rated as {Address_Rating}. At the time of visit, met with {Security_Person_Name} who informed that entry to the given premises is not allowed.

ENTRY RESTRICTION DETAILS:
{Security_Person_Name} {Security_Confirmation} the property existence at the given address. Entry is restricted due to: {Entry_Restriction_Reason}.

LOCALITY INFORMATION:
The locality is {Locality} with an address structure of G+{Address_Structure_G_Plus}. The building color is {Address_Structure_Color} and door color is {Door_Color}.

AREA ASSESSMENT:
Landmarks nearby: {Landmark_1} and {Landmark_2}. {Dominated_Area_Text}. {Feedback_From_Neighbour} feedback received from neighbours. {Political_Connection_Text}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    UNTRACEABLE: `Property Individual Remark: UNTRACEABLE.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is incorrect and untraceable.

CONTACT ATTEMPT:
We called {Customer_Name}, but {Call_Remark}. Proper guidance is required to trace the property address.

SEARCH EFFORTS:
The locality type is {Locality}. Field executive reached up to the following landmarks: {Landmark_1}, {Landmark_2}, {Landmark_3}, {Landmark_4}. {Dominated_Area_Text}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,
  };

  /**
   * Generate template-based report for verification form submission
   */
  generateTemplateReport(data: VerificationReportData): TemplateReportResult {
    try {
      logger.info('Generating template-based report', {
        verificationType: data.verificationType,
        outcome: data.outcome,
        caseId: data.caseDetails.caseId,
      });

      // Get appropriate template
      const template = this.getTemplate(data.verificationType, data.outcome, data.formData);
      if (!template) {
        throw new Error(`No template found for ${data.verificationType} - ${data.outcome}`);
      }

      // Map form data to template variables
      const templateVariables = this.mapFormDataToTemplateVariables(
        data.formData,
        data.caseDetails
      );

      // Replace template variables with actual data
      let populatedTemplate = template;
      Object.entries(templateVariables).forEach(([key, value]) => {
        const placeholder = `{${key}}`;
        populatedTemplate = populatedTemplate.replace(new RegExp(placeholder, 'g'), value);
      });

      logger.info('Template-based report generated successfully', {
        caseId: data.caseDetails.caseId,
        templateUsed: this.getTemplateKey(data.verificationType, data.outcome, data.formData),
      });

      return {
        success: true,
        report: populatedTemplate,
        metadata: {
          verificationType: data.verificationType,
          outcome: data.outcome,
          generatedAt: new Date().toISOString(),
          templateUsed: this.getTemplateKey(data.verificationType, data.outcome, data.formData),
        },
      };
    } catch (error) {
      logger.error('Error generating template-based report:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Get template for specific verification type and outcome
   */
  private getTemplate(
    verificationType: string,
    outcome: string,
    formData?: Record<string, unknown>
  ): string | null {
    const templateKey = this.getTemplateKey(verificationType, outcome, formData);

    if (verificationType.toUpperCase() === 'RESIDENCE') {
      return this.RESIDENCE_TEMPLATES[templateKey] || null;
    }

    if (verificationType.toUpperCase() === 'OFFICE') {
      return this.OFFICE_TEMPLATES[templateKey] || null;
    }

    if (verificationType.toUpperCase() === 'BUSINESS') {
      return this.BUSINESS_TEMPLATES[templateKey] || null;
    }

    if (verificationType.toUpperCase() === 'RESIDENCE_CUM_OFFICE') {
      return this.RESIDENCE_CUM_OFFICE_TEMPLATES[templateKey] || null;
    }

    if (verificationType.toUpperCase() === 'BUILDER') {
      return this.BUILDER_TEMPLATES[templateKey] || null;
    }

    if (verificationType.toUpperCase() === 'NOC') {
      return this.NOC_TEMPLATES[templateKey] || null;
    }

    if (verificationType.toUpperCase() === 'DSA_CONNECTOR') {
      return this.DSA_CONNECTOR_TEMPLATES[templateKey] || null;
    }

    if (verificationType.toUpperCase() === 'PROPERTY_APF') {
      return this.PROPERTY_APF_TEMPLATES[templateKey] || null;
    }

    if (verificationType.toUpperCase() === 'PROPERTY_INDIVIDUAL') {
      return this.PROPERTY_INDIVIDUAL_TEMPLATES[templateKey] || null;
    }

    // Add other verification types here as needed
    return null;
  }

  /**
   * Get template key based on verification type and outcome
   */
  private getTemplateKey(
    verificationType: string,
    outcome: string,
    formData?: Record<string, unknown>
  ): string {
    const outcomeNormalized = outcome.toLowerCase();

    // Property APF has only 4 outcomes — handle BEFORE universal check
    if (verificationType.toUpperCase() === 'PROPERTY_APF') {
      if (outcomeNormalized.includes('ert') || outcomeNormalized === 'ert') {
        return 'ERT';
      }
      if (outcomeNormalized.includes('untraceable')) {
        return 'UNTRACEABLE';
      }
      if (outcomeNormalized.includes('negative')) {
        return 'NEGATIVE';
      }
      return 'POSITIVE';
    }

    // Property Individual has 6 outcomes — no SHIFTED variants
    if (verificationType.toUpperCase() === 'PROPERTY_INDIVIDUAL') {
      if (outcomeNormalized.includes('ert') || outcomeNormalized === 'ert') {
        return 'ERT';
      }
      if (outcomeNormalized.includes('untraceable')) {
        return 'UNTRACEABLE';
      }
      if (outcomeNormalized.includes('nsp')) {
        if (outcomeNormalized.includes('door open')) {
          return 'NSP_DOOR_OPEN';
        }
        if (outcomeNormalized.includes('door lock') || outcomeNormalized.includes('door locked')) {
          return 'NSP_DOOR_LOCKED';
        }
        // Fallback: check propertyStatus
        const propStatus = (formData?.propertyStatus || formData?.property_status) as
          | string
          | undefined;
        return propStatus && propStatus.toLowerCase() === 'opened'
          ? 'NSP_DOOR_OPEN'
          : 'NSP_DOOR_LOCKED';
      }
      if (outcomeNormalized.includes('positive')) {
        if (outcomeNormalized.includes('door open')) {
          return 'POSITIVE_DOOR_OPEN';
        }
        if (outcomeNormalized.includes('door lock') || outcomeNormalized.includes('door locked')) {
          return 'POSITIVE_DOOR_LOCKED';
        }
        const propStatus = (formData?.propertyStatus || formData?.property_status) as
          | string
          | undefined;
        return propStatus && propStatus.toLowerCase() === 'opened'
          ? 'POSITIVE_DOOR_OPEN'
          : 'POSITIVE_DOOR_LOCKED';
      }
      // Default
      return 'POSITIVE_DOOR_OPEN';
    }

    // Universal outcome string matching — works for all verification types
    // When the outcome explicitly says "Door Open" or "Door Locked", use that directly
    if (outcomeNormalized.includes('positive') && outcomeNormalized.includes('door open')) {
      return 'POSITIVE_DOOR_OPEN';
    }
    if (
      outcomeNormalized.includes('positive') &&
      (outcomeNormalized.includes('door lock') || outcomeNormalized.includes('door locked'))
    ) {
      return 'POSITIVE_DOOR_LOCKED';
    }
    if (outcomeNormalized.includes('shifted') && outcomeNormalized.includes('door open')) {
      return 'SHIFTED_DOOR_OPEN';
    }
    if (
      outcomeNormalized.includes('shifted') &&
      (outcomeNormalized.includes('door lock') || outcomeNormalized.includes('door locked'))
    ) {
      return 'SHIFTED_DOOR_LOCKED';
    }
    if (outcomeNormalized.includes('nsp') && outcomeNormalized.includes('door open')) {
      return 'NSP_DOOR_OPEN';
    }
    if (
      outcomeNormalized.includes('nsp') &&
      (outcomeNormalized.includes('door lock') || outcomeNormalized.includes('door locked'))
    ) {
      return 'NSP_DOOR_LOCKED';
    }
    if (outcomeNormalized.includes('ert') || outcomeNormalized === 'entry restricted') {
      return 'ERT';
    }
    if (outcomeNormalized.includes('untraceable')) {
      return 'UNTRACEABLE';
    }

    // Type-specific fallback (uses status fields like houseStatus/officeStatus)
    if (verificationType.toUpperCase() === 'RESIDENCE') {
      // Handle Shifted scenarios
      if (outcomeNormalized.includes('shifted')) {
        if (
          outcomeNormalized.includes('door lock') ||
          outcomeNormalized.includes('door locked') ||
          outcomeNormalized.includes('locked')
        ) {
          return 'SHIFTED_DOOR_LOCKED';
        } else {
          return 'SHIFTED_DOOR_OPEN';
        }
      }

      // Handle ERT scenarios
      if (outcomeNormalized.includes('ert') || outcomeNormalized === 'ert') {
        return 'ERT';
      }

      // Handle Untraceable scenarios
      if (outcomeNormalized.includes('untraceable') || outcomeNormalized === 'untraceable') {
        return 'UNTRACEABLE';
      }

      // Handle NSP scenarios
      if (outcomeNormalized.includes('nsp') || outcomeNormalized.includes('no such person')) {
        if (
          outcomeNormalized.includes('door lock') ||
          outcomeNormalized.includes('door locked') ||
          outcomeNormalized.includes('locked')
        ) {
          return 'NSP_DOOR_LOCKED';
        } else {
          return 'NSP_DOOR_OPEN';
        }
      }

      // Handle Positive scenarios - use house status to determine template
      if (outcomeNormalized.includes('positive')) {
        const houseStatus = (formData?.houseStatus || formData?.house_status) as string | undefined;
        if (houseStatus && houseStatus.toLowerCase() === 'opened') {
          return 'POSITIVE_DOOR_OPEN'; // Door was open, person was met
        } else {
          return 'POSITIVE_DOOR_LOCKED'; // Door was closed/locked
        }
      }
    }

    if (verificationType.toUpperCase() === 'OFFICE') {
      // Handle Shifted scenarios - use office status to determine template
      if (outcomeNormalized.includes('shifted')) {
        const officeStatus = (formData?.officeStatus || formData?.office_status) as
          | string
          | undefined;
        if (officeStatus && officeStatus.toLowerCase() === 'opened') {
          return 'SHIFTED_DOOR_OPEN'; // Office was open, person was met
        } else {
          return 'SHIFTED_DOOR_LOCKED'; // Office was closed, only TPC
        }
      }

      // Handle ERT scenarios
      if (outcomeNormalized.includes('ert') || outcomeNormalized === 'ert') {
        return 'ERT';
      }

      // Handle Untraceable scenarios
      if (outcomeNormalized.includes('untraceable') || outcomeNormalized === 'untraceable') {
        return 'UNTRACEABLE';
      }

      // Handle NSP scenarios - use office status to determine template
      if (outcomeNormalized.includes('nsp')) {
        const officeStatus = (formData?.officeStatus || formData?.office_status) as
          | string
          | undefined;
        if (officeStatus && officeStatus.toLowerCase() === 'opened') {
          return 'NSP_DOOR_OPEN'; // Office was open, person was met
        } else {
          return 'NSP_DOOR_LOCKED'; // Office was closed, only TPC
        }
      }

      // Handle Positive scenarios - use office status to determine template
      if (outcomeNormalized.includes('positive')) {
        // Check office status to determine if person was met or only TPC was done
        const officeStatus = (formData?.officeStatus || formData?.office_status) as
          | string
          | undefined;
        if (officeStatus && officeStatus.toLowerCase() === 'opened') {
          return 'POSITIVE_DOOR_OPEN'; // Office was open, person was met
        } else {
          return 'POSITIVE_DOOR_LOCKED'; // Office was closed, only TPC
        }
      }
    }

    if (verificationType.toUpperCase() === 'BUSINESS') {
      // Handle Shifted scenarios - use business status to determine template
      if (outcomeNormalized.includes('shifted')) {
        const businessStatus = (formData?.businessStatus || formData?.business_status) as
          | string
          | undefined;
        if (businessStatus && businessStatus.toLowerCase() === 'opened') {
          return 'SHIFTED_DOOR_OPEN'; // Business was open, person was met
        } else {
          return 'SHIFTED_DOOR_LOCKED'; // Business was closed, only TPC
        }
      }

      // Handle ERT scenarios
      if (outcomeNormalized.includes('ert') || outcomeNormalized === 'ert') {
        return 'ERT';
      }

      // Handle Untraceable scenarios
      if (outcomeNormalized.includes('untraceable') || outcomeNormalized === 'untraceable') {
        return 'UNTRACEABLE';
      }

      // Handle NSP scenarios - use business status to determine template
      if (outcomeNormalized.includes('nsp')) {
        const businessStatus = (formData?.businessStatus || formData?.business_status) as
          | string
          | undefined;
        if (businessStatus && businessStatus.toLowerCase() === 'opened') {
          return 'NSP_DOOR_OPEN'; // Business was open, person was met
        } else {
          return 'NSP_DOOR_LOCKED'; // Business was closed, only TPC
        }
      }

      // Handle Positive scenarios - use business status to determine template
      if (outcomeNormalized.includes('positive')) {
        const businessStatus = (formData?.businessStatus || formData?.business_status) as
          | string
          | undefined;
        if (businessStatus && businessStatus.toLowerCase() === 'opened') {
          return 'POSITIVE_DOOR_OPEN'; // Business was open, person was met
        } else {
          return 'POSITIVE_DOOR_LOCKED'; // Business was closed, only TPC
        }
      }
    }

    if (verificationType.toUpperCase() === 'RESIDENCE_CUM_OFFICE') {
      // Handle Shifted scenarios - use house/office status to determine template
      if (outcomeNormalized.includes('shifted')) {
        const houseStatus = (formData?.houseStatus || formData?.house_status) as string | undefined;
        const officeStatus = (formData?.officeStatus || formData?.office_status) as
          | string
          | undefined;
        if (
          (houseStatus && houseStatus.toLowerCase() === 'opened') ||
          (officeStatus && officeStatus.toLowerCase() === 'opened')
        ) {
          return 'SHIFTED_DOOR_OPEN'; // Either residence or office was accessible
        } else {
          return 'SHIFTED_DOOR_LOCKED'; // Both were closed, only TPC
        }
      }

      // Handle ERT scenarios
      if (outcomeNormalized.includes('ert') || outcomeNormalized === 'ert') {
        return 'ERT';
      }

      // Handle Untraceable scenarios
      if (outcomeNormalized.includes('untraceable') || outcomeNormalized === 'untraceable') {
        return 'UNTRACEABLE';
      }

      // Handle NSP scenarios - use house/office status to determine template
      if (outcomeNormalized.includes('nsp')) {
        const houseStatus = (formData?.houseStatus || formData?.house_status) as string | undefined;
        const officeStatus = (formData?.officeStatus || formData?.office_status) as
          | string
          | undefined;
        if (
          (houseStatus && houseStatus.toLowerCase() === 'opened') ||
          (officeStatus && officeStatus.toLowerCase() === 'opened')
        ) {
          return 'NSP_DOOR_OPEN'; // Either residence or office was accessible
        } else {
          return 'NSP_DOOR_LOCKED'; // Both were closed, only TPC
        }
      }

      // Handle Positive scenarios - use house/office status to determine template
      if (outcomeNormalized.includes('positive')) {
        const houseStatus = (formData?.houseStatus || formData?.house_status) as string | undefined;
        const officeStatus = (formData?.officeStatus || formData?.office_status) as
          | string
          | undefined;
        if (
          (houseStatus && houseStatus.toLowerCase() === 'opened') ||
          (officeStatus && officeStatus.toLowerCase() === 'opened')
        ) {
          return 'POSITIVE_DOOR_OPEN'; // Either residence or office was accessible
        } else {
          return 'POSITIVE_DOOR_LOCKED'; // Both were closed, only TPC
        }
      }
    }

    if (verificationType.toUpperCase() === 'BUILDER') {
      // Handle Shifted scenarios - use office status to determine template
      if (outcomeNormalized.includes('shifted')) {
        const officeStatus = (formData?.officeStatus || formData?.office_status) as
          | string
          | undefined;
        if (officeStatus && officeStatus.toLowerCase() === 'opened') {
          return 'SHIFTED_DOOR_OPEN'; // Builder office was open, person was met
        } else {
          return 'SHIFTED_DOOR_LOCKED'; // Builder office was closed, only TPC
        }
      }

      // Handle ERT scenarios
      if (outcomeNormalized.includes('ert') || outcomeNormalized === 'ert') {
        return 'ERT';
      }

      // Handle Untraceable scenarios
      if (outcomeNormalized.includes('untraceable') || outcomeNormalized === 'untraceable') {
        return 'UNTRACEABLE';
      }

      // Handle NSP scenarios - use office status to determine template
      if (outcomeNormalized.includes('nsp')) {
        const officeStatus = (formData?.officeStatus || formData?.office_status) as
          | string
          | undefined;
        if (officeStatus && officeStatus.toLowerCase() === 'opened') {
          return 'NSP_DOOR_OPEN'; // Builder office was open, person was met
        } else {
          return 'NSP_DOOR_LOCKED'; // Builder office was closed, only TPC
        }
      }

      // Handle Positive scenarios - use office status to determine template
      if (outcomeNormalized.includes('positive')) {
        const officeStatus = (formData?.officeStatus || formData?.office_status) as
          | string
          | undefined;
        if (officeStatus && officeStatus.toLowerCase() === 'opened') {
          return 'POSITIVE_DOOR_OPEN'; // Builder office was open, person was met
        } else {
          return 'POSITIVE_DOOR_LOCKED'; // Builder office was closed, only TPC
        }
      }
    }

    if (verificationType.toUpperCase() === 'NOC') {
      if (outcomeNormalized.includes('shifted')) {
        if (outcomeNormalized.includes('door lock') || outcomeNormalized.includes('locked')) {
          return 'SHIFTED_DOOR_LOCKED';
        }
        return 'SHIFTED_DOOR_OPEN';
      }
      if (outcomeNormalized.includes('ert') || outcomeNormalized === 'ert') {
        return 'ERT';
      }
      if (outcomeNormalized.includes('untraceable') || outcomeNormalized === 'untraceable') {
        return 'UNTRACEABLE';
      }
      if (outcomeNormalized.includes('nsp') || outcomeNormalized.includes('no such person')) {
        if (outcomeNormalized.includes('door lock') || outcomeNormalized.includes('locked')) {
          return 'NSP_DOOR_LOCKED';
        }
        return 'NSP_DOOR_OPEN';
      }
      if (outcomeNormalized.includes('positive')) {
        if (outcomeNormalized.includes('door open')) {
          return 'POSITIVE_DOOR_OPEN';
        }
        const officeStatus = (formData?.officeStatus || formData?.office_status) as
          | string
          | undefined;
        if (officeStatus && officeStatus.toLowerCase() === 'opened') {
          return 'POSITIVE_DOOR_OPEN';
        }
        return 'POSITIVE_DOOR_LOCKED';
      }
    }

    if (verificationType.toUpperCase() === 'DSA_CONNECTOR') {
      // Handle Shifted scenarios - use office status to determine template
      if (outcomeNormalized.includes('shifted')) {
        const officeStatus = (formData?.officeStatus || formData?.office_status) as
          | string
          | undefined;
        if (officeStatus && officeStatus.toLowerCase() === 'opened') {
          return 'SHIFTED_DOOR_OPEN'; // DSA/Connector office was open, person was met
        } else {
          return 'SHIFTED_DOOR_LOCKED'; // DSA/Connector office was closed, only TPC
        }
      }

      // Handle ERT scenarios
      if (outcomeNormalized.includes('ert') || outcomeNormalized === 'ert') {
        return 'ERT';
      }

      // Handle Untraceable scenarios
      if (outcomeNormalized.includes('untraceable') || outcomeNormalized === 'untraceable') {
        return 'UNTRACEABLE';
      }

      // Handle NSP scenarios - use office status to determine template
      if (outcomeNormalized.includes('nsp')) {
        const officeStatus = (formData?.officeStatus || formData?.office_status) as
          | string
          | undefined;
        if (officeStatus && officeStatus.toLowerCase() === 'opened') {
          return 'NSP_DOOR_OPEN'; // DSA/Connector office was open, person was met
        } else {
          return 'NSP_DOOR_LOCKED'; // DSA/Connector office was closed, only TPC
        }
      }

      // Handle Positive scenarios - use office status to determine template
      if (outcomeNormalized.includes('positive')) {
        const officeStatus = (formData?.officeStatus || formData?.office_status) as
          | string
          | undefined;
        if (officeStatus && officeStatus.toLowerCase() === 'opened') {
          return 'POSITIVE_DOOR_OPEN'; // DSA/Connector office was open, person was met
        } else {
          return 'POSITIVE_DOOR_LOCKED'; // DSA/Connector office was closed, only TPC
        }
      }
    }

    // PROPERTY_APF handled at top of getTemplateKey

    // PROPERTY_INDIVIDUAL handled at top of getTemplateKey

    return 'DEFAULT';
  }

  /**
   * Get proper customer name, fallback to met person name if customer name is invalid
   */
  private getCustomerName(
    formData: Record<string, unknown>,
    caseDetails: VerificationCaseDetails
  ): string {
    const customerName = caseDetails.customerName;
    const metPersonName = (formData?.metPersonName || formData?.met_person_name) as
      | string
      | undefined;

    // Check if customer name looks like test data or is invalid
    if (
      !customerName ||
      customerName.toLowerCase().includes('test') ||
      customerName.toLowerCase().includes('residance') ||
      customerName.toLowerCase().includes('door') ||
      customerName.toLowerCase().includes('positive') ||
      customerName.toLowerCase().includes('report')
    ) {
      return metPersonName || 'Customer';
    }

    return customerName;
  }

  /**
   * Format area in square feet with proper units
   */
  private formatAreaSqFeet(formData: Record<string, unknown>, type = 'residence'): string {
    let area: unknown;

    if (type === 'office') {
      area = formData?.officeApproxArea || formData?.office_approx_area || formData?.officeArea;
    } else if (type === 'business') {
      area =
        formData?.businessApproxArea || formData?.business_approx_area || formData?.businessArea;
    } else {
      area =
        formData?.approxArea ||
        formData?.approx_area ||
        formData?.approximateArea ||
        formData?.approxAreaSqFeet;
    }

    const value = Number(area);
    if (!isNaN(value) && value > 0) {
      return `${value} sq. feet`;
    }

    return 'Not provided';
  }

  /**
   * Map form data to template variables for verification reports
   */
  private mapFormDataToTemplateVariables(
    formData: Record<string, unknown>,
    caseDetails: VerificationCaseDetails
  ): Record<string, string> {
    const safeGet = (
      obj: Record<string, unknown>,
      key: string,
      defaultValue = 'Not provided'
    ): string => {
      return (
        (obj?.[key] as string) ||
        (obj?.[key.toLowerCase()] as string) ||
        (obj?.[key.replace(/([A-Z])/g, '_$1').toLowerCase()] as string) ||
        defaultValue
      );
    };

    return {
      // Address and basic info
      ADDRESS: caseDetails.address || 'Address not provided',
      Address_Locatable: safeGet(formData, 'addressLocatable'),
      Address_Rating: safeGet(formData, 'addressRating'),

      // Person details
      Met_Person_Name:
        safeGet(formData, 'metPersonName') ||
        safeGet(formData, 'personMet') ||
        safeGet(formData, 'met_person_name'),
      Customer_Name: this.getCustomerName(formData, caseDetails),
      Applicant_Type: caseDetails.applicantType || 'APPLICANT',
      Applicant_Status:
        caseDetails.customerName ||
        safeGet(formData, 'customerName') ||
        safeGet(formData, 'applicantStatus') ||
        'Applicant',
      Met_Person_Relation: safeGet(formData, 'metPersonRelation') || safeGet(formData, 'relation'),

      // Staying details
      Staying_Period: safeGet(formData, 'stayingPeriod') || safeGet(formData, 'stayingSince'),
      Staying_Status: safeGet(formData, 'stayingStatus'),

      // Property details
      Approx_Area_Sq_Feet: this.formatAreaSqFeet(formData),
      Total_Family_Members:
        safeGet(formData, 'totalFamilyMembers') || safeGet(formData, 'familyMembers'),
      Total_Earning_Members:
        safeGet(formData, 'totalEarningMember') || safeGet(formData, 'earningMembers'),

      // Work details
      Working_Status: safeGet(formData, 'workingStatus'),
      Company_Name: safeGet(formData, 'companyName') || safeGet(formData, 'employerName'),

      // Name plates and boards
      Door_Name_Plate: /^sighted/i.test(safeGet(formData, 'doorNamePlateStatus') || '')
        ? 'Available'
        : 'Not Available',
      Name_on_Door_Plate:
        safeGet(formData, 'nameOnDoorPlate') || safeGet(formData, 'doorNamePlate'),
      Door_Name_Plate_Text: /^sighted/i.test(safeGet(formData, 'doorNamePlateStatus') || '')
        ? `shows the name "${safeGet(formData, 'nameOnDoorPlate') || 'N/A'}"`
        : 'is not sighted',
      // Company nameplate (for Office/Business/Builder forms)
      Company_Name_Plate: /^sighted/i.test(safeGet(formData, 'companyNamePlateStatus') || '')
        ? 'Available'
        : 'Not Available',
      Company_Name_Plate_Text: /^sighted/i.test(safeGet(formData, 'companyNamePlateStatus') || '')
        ? `displays "${safeGet(formData, 'nameOnBoard') || safeGet(formData, 'nameOnCompanyBoard') || 'N/A'}"`
        : 'is not sighted',
      Name_On_Board: safeGet(formData, 'nameOnBoard') || safeGet(formData, 'nameOnCompanyBoard'),

      Society_Name_Plate: /^sighted/i.test(safeGet(formData, 'societyNamePlateStatus') || '')
        ? 'Available'
        : 'Not Available',
      Name_on_Society_Board:
        safeGet(formData, 'nameOnSocietyBoard') || safeGet(formData, 'societyNamePlate'),
      Society_Name_Plate_Text: /^sighted/i.test(safeGet(formData, 'societyNamePlateStatus') || '')
        ? `displays "${safeGet(formData, 'nameOnSocietyBoard') || 'N/A'}"`
        : 'is not sighted',

      // Locality details
      Locality:
        (formData.locality as string) || (formData.localityType as string) || 'Not provided',
      Address_Structure_G_Plus:
        safeGet(formData, 'addressStructure') || safeGet(formData, 'addressStructureGPlus'),
      Applicant_Staying_Floor:
        safeGet(formData, 'applicantStayingFloor') ||
        safeGet(formData, 'addressFloor') ||
        safeGet(formData, 'floor') ||
        'Ground',
      Address_Structure_Color:
        safeGet(formData, 'addressStructureColor') || safeGet(formData, 'buildingColor'),
      Door_Color: safeGet(formData, 'doorColor'),

      // Documents
      Document_Type: safeGet(formData, 'documentType'),

      // TPC details
      TPC_Met_Person_1: safeGet(formData, 'tpcMetPerson1') || safeGet(formData, 'tpcMetPerson'),
      Name_of_TPC_1: safeGet(formData, 'nameOfTpc1') || safeGet(formData, 'tpcName1'),
      TPC_Confirmation_1:
        safeGet(formData, 'tpcConfirmation1') || safeGet(formData, 'tpcConfirmation'),
      TPC_Met_Person_2: safeGet(formData, 'tpcMetPerson2'),
      Name_of_TPC_2: safeGet(formData, 'nameOfTpc2') || safeGet(formData, 'tpcName2'),
      TPC_Confirmation_2: safeGet(formData, 'tpcConfirmation2'),

      // Landmarks
      Landmark_1: safeGet(formData, 'landmark1') || safeGet(formData, 'nearbyLandmark1'),
      Landmark_2: safeGet(formData, 'landmark2') || safeGet(formData, 'nearbyLandmark2'),
      Landmark_3:
        safeGet(formData, 'landmark3') || safeGet(formData, 'nearbyLandmark3') || 'Not provided',
      Landmark_4:
        safeGet(formData, 'landmark4') || safeGet(formData, 'nearbyLandmark4') || 'Not provided',

      // Area assessment
      Dominated_Area: safeGet(formData, 'dominatedArea'),
      Dominated_Area_Text:
        safeGet(formData, 'dominatedArea') === 'No'
          ? 'The area is not dominated by any particular community'
          : `The area is ${safeGet(formData, 'dominatedArea') || 'mixed'} dominated`,
      Feedback_from_Neighbour:
        safeGet(formData, 'feedbackFromNeighbour') || safeGet(formData, 'neighborFeedback'),
      Political_Connection: safeGet(formData, 'politicalConnection'),
      Political_Connection_Text:
        safeGet(formData, 'politicalConnection') === 'No'
          ? 'No political connections were found'
          : `Political connection: ${safeGet(formData, 'politicalConnection') || 'Unknown'}`,
      Other_Observation:
        safeGet(formData, 'otherObservation') ||
        safeGet(formData, 'remarks') ||
        safeGet(formData, 'verifierComments'),
      Final_Status:
        safeGet(formData, 'finalStatus') || safeGet(formData, 'verificationOutcome') || 'Positive',

      // Call-related fields for Untraceable template
      Call_Remark:
        safeGet(formData, 'callRemark') ||
        safeGet(formData, 'phoneCallRemark') ||
        'did not respond',

      // NSP-specific fields
      Staying_Person_Name:
        safeGet(formData, 'stayingPersonName') ||
        safeGet(formData, 'actualResidentName') ||
        'Not provided',

      // Additional variables for shifted templates
      House_Status: safeGet(formData, 'houseStatus') || safeGet(formData, 'doorStatus'),
      Shifted_Period: safeGet(formData, 'shiftedPeriod') || safeGet(formData, 'shiftingSince'),
      Door_Name_Plate_Status: safeGet(formData, 'doorNamePlateStatus'),
      Society_Name_Plate_Status: safeGet(formData, 'societyNamePlateStatus'),
      Locality_Type: safeGet(formData, 'localityType') || safeGet(formData, 'locality'),
      Address_Structure: safeGet(formData, 'addressStructure'),
      Address_Floor: safeGet(formData, 'addressFloor') || safeGet(formData, 'floor'),
      Feedback_From_Neighbour:
        safeGet(formData, 'feedbackFromNeighbour') || safeGet(formData, 'neighborFeedback'),
      Premises_Status:
        safeGet(formData, 'premisesStatus') || safeGet(formData, 'currentPremisesStatus'),

      // Office-specific variables
      Office_Status: safeGet(formData, 'officeStatus') || safeGet(formData, 'office_status'),
      Designation: safeGet(formData, 'designation') || safeGet(formData, 'metPersonDesignation'),
      Working_Period: safeGet(formData, 'workingPeriod') || safeGet(formData, 'working_period'),
      Applicant_Designation:
        safeGet(formData, 'applicantDesignation') || safeGet(formData, 'applicant_designation'),
      Applicant_Working_Premises:
        safeGet(formData, 'applicantWorkingPremises') ||
        safeGet(formData, 'applicant_working_premises'),
      Sitting_Location:
        safeGet(formData, 'sittingLocation') || safeGet(formData, 'sitting_location'),
      Office_Type: safeGet(formData, 'officeType') || safeGet(formData, 'office_type'),
      Company_Nature_Of_Business:
        safeGet(formData, 'companyNatureOfBusiness') ||
        safeGet(formData, 'company_nature_of_business'),
      Staff_Strength: safeGet(formData, 'staffStrength') || safeGet(formData, 'staff_strength'),
      Staff_Seen: safeGet(formData, 'staffSeen') || safeGet(formData, 'staff_seen'),
      Office_Approx_Area: this.formatAreaSqFeet(formData, 'office'),

      // Office SHIFTED-specific variables
      Old_Office_Shifted_Period:
        safeGet(formData, 'oldOfficeShiftedPeriod') ||
        safeGet(formData, 'old_office_shifted_period') ||
        safeGet(formData, 'shiftedPeriod'),
      Current_Company_Name:
        safeGet(formData, 'currentCompanyName') ||
        safeGet(formData, 'current_company_name') ||
        safeGet(formData, 'companyName'),
      Current_Company_Period:
        safeGet(formData, 'currentCompanyPeriod') ||
        safeGet(formData, 'current_company_period') ||
        safeGet(formData, 'establishmentPeriod'),

      // ERT-specific variables (Entry Restricted)
      Met_Person_Type:
        safeGet(formData, 'metPersonType') || safeGet(formData, 'met_person_type') || 'Security',
      Name_Of_Met_Person:
        safeGet(formData, 'nameOfMetPerson') ||
        safeGet(formData, 'name_of_met_person') ||
        safeGet(formData, 'metPersonName'),
      Name_of_Met_Person:
        safeGet(formData, 'nameOfMetPerson') ||
        safeGet(formData, 'name_of_met_person') ||
        safeGet(formData, 'metPersonName'),
      Met_Person_Confirmation:
        safeGet(formData, 'metPersonConfirmation') ||
        safeGet(formData, 'met_person_confirmation') ||
        'confirmed',
      Met_Person_Status:
        safeGet(formData, 'metPersonStatus') || safeGet(formData, 'met_person_status'),
      Applicant_Staying_Status:
        safeGet(formData, 'applicantStayingStatus') ||
        safeGet(formData, 'applicant_staying_status'),
      Office_Exist_Floor:
        safeGet(formData, 'officeExistFloor') ||
        safeGet(formData, 'office_exist_floor') ||
        safeGet(formData, 'addressFloor') ||
        safeGet(formData, 'floor'),

      // Office NSP-specific variables
      Third_Party_Confirmation:
        safeGet(formData, 'thirdPartyConfirmation') ||
        safeGet(formData, 'third_party_confirmation') ||
        'confirmed',
      Office_Existence:
        safeGet(formData, 'officeExistence') || safeGet(formData, 'office_existence') || 'exists',

      // NOC-specific variables
      NOC_Type: safeGet(formData, 'nocType') || safeGet(formData, 'noc_type'),
      NOC_Number: safeGet(formData, 'nocNumber') || safeGet(formData, 'noc_number'),
      NOC_Status: safeGet(formData, 'nocStatus') || safeGet(formData, 'noc_status'),
      NOC_Issue_Date: safeGet(formData, 'nocIssueDate') || safeGet(formData, 'noc_issue_date'),
      NOC_Expiry_Date: safeGet(formData, 'nocExpiryDate') || safeGet(formData, 'noc_expiry_date'),
      NOC_Issuing_Authority:
        safeGet(formData, 'nocIssuingAuthority') || safeGet(formData, 'noc_issuing_authority'),
      NOC_Validity_Status:
        safeGet(formData, 'nocValidityStatus') || safeGet(formData, 'noc_validity_status'),
      Project_Name: safeGet(formData, 'projectName') || safeGet(formData, 'project_name'),
      Project_Status: safeGet(formData, 'projectStatus') || safeGet(formData, 'project_status'),
      Construction_Status:
        safeGet(formData, 'constructionStatus') || safeGet(formData, 'construction_status'),
      Total_Units: safeGet(formData, 'totalUnits') || safeGet(formData, 'total_units'),
      Completed_Units: safeGet(formData, 'completedUnits') || safeGet(formData, 'completed_units'),
      Sold_Units: safeGet(formData, 'soldUnits') || safeGet(formData, 'sold_units'),
      Builder_Registration_Number:
        safeGet(formData, 'builderRegistrationNumber') ||
        safeGet(formData, 'reraRegistrationNumber'),
      Environmental_Clearance:
        safeGet(formData, 'environmentalClearance') || safeGet(formData, 'environmental_clearance'),
      Fire_Safety_Clearance:
        safeGet(formData, 'fireSafetyClearance') || safeGet(formData, 'fire_safety_clearance'),
      Pollution_Clearance:
        safeGet(formData, 'pollutionClearance') || safeGet(formData, 'pollution_clearance'),
      Water_Connection_Status:
        safeGet(formData, 'waterConnectionStatus') || safeGet(formData, 'water_connection_status'),
      Electricity_Connection_Status:
        safeGet(formData, 'electricityConnectionStatus') ||
        safeGet(formData, 'electricity_connection_status'),
      Current_Location:
        safeGet(formData, 'currentLocation') || safeGet(formData, 'current_location'),

      // DSA/Connector-specific variables
      Connector_Type: safeGet(formData, 'connectorType') || safeGet(formData, 'connector_type'),
      Connector_Code: safeGet(formData, 'connectorCode') || safeGet(formData, 'connector_code'),
      Connector_Name: safeGet(formData, 'connectorName') || safeGet(formData, 'connector_name'),
      Connector_Designation:
        safeGet(formData, 'connectorDesignation') || safeGet(formData, 'connector_designation'),
      Connector_Experience:
        safeGet(formData, 'connectorExperience') || safeGet(formData, 'connector_experience'),
      Connector_Status:
        safeGet(formData, 'connectorStatus') || safeGet(formData, 'connector_status'),
      Annual_Turnover: safeGet(formData, 'annualTurnover') || safeGet(formData, 'annual_turnover'),
      Total_Staff: safeGet(formData, 'totalStaff') || safeGet(formData, 'total_staff'),
      Sales_Staff: safeGet(formData, 'salesStaff') || safeGet(formData, 'sales_staff'),
      Support_Staff: safeGet(formData, 'supportStaff') || safeGet(formData, 'support_staff'),
      Office_Area: safeGet(formData, 'officeArea') || safeGet(formData, 'office_area'),
      License_Number: safeGet(formData, 'licenseNumber') || safeGet(formData, 'license_number'),
      License_Status: safeGet(formData, 'licenseStatus') || safeGet(formData, 'license_status'),
      License_Expiry_Date:
        safeGet(formData, 'licenseExpiryDate') || safeGet(formData, 'license_expiry_date'),
      Compliance_Status:
        safeGet(formData, 'complianceStatus') || safeGet(formData, 'compliance_status'),
      Audit_Status: safeGet(formData, 'auditStatus') || safeGet(formData, 'audit_status'),
      Training_Status: safeGet(formData, 'trainingStatus') || safeGet(formData, 'training_status'),
      Market_Presence: safeGet(formData, 'marketPresence') || safeGet(formData, 'market_presence'),
      Market_Reputation:
        safeGet(formData, 'marketReputation') || safeGet(formData, 'market_reputation'),
      Customer_Feedback:
        safeGet(formData, 'customerFeedback') || safeGet(formData, 'customer_feedback'),
      Risk_Assessment: safeGet(formData, 'riskAssessment') || safeGet(formData, 'risk_assessment'),
      Business_Name: safeGet(formData, 'businessName') || safeGet(formData, 'business_name'),
      Business_Registration_Number: safeGet(formData, 'businessRegistrationNumber') || safeGet(formData, 'business_registration_number'),
      Business_Establishment_Year: safeGet(formData, 'businessEstablishmentYear') || safeGet(formData, 'business_establishment_year'),
      Previous_Business_Name:
        safeGet(formData, 'previousBusinessName') || safeGet(formData, 'previous_business_name'),
      Business_Name:
        safeGet(formData, 'businessName') ||
        safeGet(formData, 'business_name') ||
        safeGet(formData, 'connectorName'),
      Business_Registration_Number:
        safeGet(formData, 'businessRegistrationNumber') ||
        safeGet(formData, 'business_registration_number') ||
        safeGet(formData, 'licenseNumber'),
      Business_Establishment_Year:
        safeGet(formData, 'businessEstablishmentYear') ||
        safeGet(formData, 'business_establishment_year') ||
        safeGet(formData, 'connectorExperience'),
      Met_Person_Designation:
        safeGet(formData, 'metPersonDesignation') || safeGet(formData, 'met_person_designation'),

      // Builder-specific variables
      Builder_Type: safeGet(formData, 'builderType') || safeGet(formData, 'builder_type'),
      Builder_Name:
        safeGet(formData, 'builderName') ||
        safeGet(formData, 'builder_name') ||
        safeGet(formData, 'builderOwnerName'),

      // Business-specific variables
      Business_Status: safeGet(formData, 'businessStatus') || safeGet(formData, 'business_status'),
      Business_Type: safeGet(formData, 'businessType') || safeGet(formData, 'business_type'),
      Ownership_Type: safeGet(formData, 'ownershipType') || safeGet(formData, 'ownership_type'),
      Business_Period: safeGet(formData, 'businessPeriod') || safeGet(formData, 'business_period'),
      Business_Approx_Area: this.formatAreaSqFeet(formData, 'business'),
      Business_Owner_Name:
        safeGet(formData, 'businessOwnerName') ||
        safeGet(formData, 'business_owner_name') ||
        safeGet(formData, 'nameOfCompanyOwners'),
      Business_Activity:
        safeGet(formData, 'businessActivity') || safeGet(formData, 'business_activity'),
      Business_Setup: safeGet(formData, 'businessSetup') || safeGet(formData, 'business_setup'),
      Business_Existence:
        safeGet(formData, 'businessExistence') ||
        safeGet(formData, 'business_existence') ||
        'exists',
      Old_Business_Shifted_Period:
        safeGet(formData, 'oldBusinessShiftedPeriod') ||
        safeGet(formData, 'old_business_shifted_period') ||
        safeGet(formData, 'shiftedPeriod'),
      Establishment_Period:
        safeGet(formData, 'establishmentPeriod') || safeGet(formData, 'establishment_period'),

      // Property APF-specific variables
      Property_Type: safeGet(formData, 'propertyType') || safeGet(formData, 'property_type'),
      Property_Status: safeGet(formData, 'propertyStatus') || safeGet(formData, 'property_status'),
      Property_Ownership:
        safeGet(formData, 'propertyOwnership') || safeGet(formData, 'property_ownership'),
      Property_Age: safeGet(formData, 'propertyAge') || safeGet(formData, 'property_age'),
      Property_Condition:
        safeGet(formData, 'propertyCondition') || safeGet(formData, 'property_condition'),
      Property_Area: safeGet(formData, 'propertyArea') || safeGet(formData, 'property_area'),
      Property_Value: safeGet(formData, 'propertyValue') || safeGet(formData, 'property_value'),
      Market_Value: safeGet(formData, 'marketValue') || safeGet(formData, 'market_value'),
      Building_Status: safeGet(formData, 'buildingStatus') || safeGet(formData, 'building_status'),
      Construction_Activity:
        safeGet(formData, 'constructionActivity') || safeGet(formData, 'construction_activity'),
      APF_Status: safeGet(formData, 'apfStatus') || safeGet(formData, 'apf_status'),
      APF_Number: safeGet(formData, 'apfNumber') || safeGet(formData, 'apf_number'),
      APF_Issue_Date: safeGet(formData, 'apfIssueDate') || safeGet(formData, 'apf_issue_date'),
      APF_Expiry_Date: safeGet(formData, 'apfExpiryDate') || safeGet(formData, 'apf_expiry_date'),
      APF_Issuing_Authority:
        safeGet(formData, 'apfIssuingAuthority') || safeGet(formData, 'apf_issuing_authority'),
      APF_Validity_Status:
        safeGet(formData, 'apfValidityStatus') || safeGet(formData, 'apf_validity_status'),
      APF_Amount: safeGet(formData, 'apfAmount') || safeGet(formData, 'apf_amount'),
      APF_Utilized_Amount:
        safeGet(formData, 'apfUtilizedAmount') || safeGet(formData, 'apf_utilized_amount'),
      APF_Balance_Amount:
        safeGet(formData, 'apfBalanceAmount') || safeGet(formData, 'apf_balance_amount'),
      Project_Approval_Status:
        safeGet(formData, 'projectApprovalStatus') || safeGet(formData, 'project_approval_status'),
      Project_Completion_Percentage:
        safeGet(formData, 'projectCompletionPercentage') ||
        safeGet(formData, 'project_completion_percentage'),
      Available_Units: safeGet(formData, 'availableUnits') || safeGet(formData, 'available_units'),
      Possession_Status:
        safeGet(formData, 'possessionStatus') || safeGet(formData, 'possession_status'),
      Developer_Name: safeGet(formData, 'developerName') || safeGet(formData, 'developer_name'),
      Legal_Clearance: safeGet(formData, 'legalClearance') || safeGet(formData, 'legal_clearance'),
      Title_Clearance: safeGet(formData, 'titleClearance') || safeGet(formData, 'title_clearance'),
      Encumbrance_Status:
        safeGet(formData, 'encumbranceStatus') || safeGet(formData, 'encumbrance_status'),
      Litigation_Status:
        safeGet(formData, 'litigationStatus') || safeGet(formData, 'litigation_status'),
      Infrastructure_Status:
        safeGet(formData, 'infrastructureStatus') || safeGet(formData, 'infrastructure_status'),
      Road_Connectivity:
        safeGet(formData, 'roadConnectivity') || safeGet(formData, 'road_connectivity'),
      Entry_Restriction_Reason:
        safeGet(formData, 'entryRestrictionReason') ||
        safeGet(formData, 'entry_restriction_reason'),
      Security_Person_Name:
        safeGet(formData, 'securityPersonName') || safeGet(formData, 'security_person_name'),
      Security_Confirmation:
        safeGet(formData, 'securityConfirmation') ||
        safeGet(formData, 'security_confirmation') ||
        'confirmed',

      // Property Individual-specific variables
      Ownership_Status:
        safeGet(formData, 'ownershipStatus') || safeGet(formData, 'ownership_status'),
    };
  }
}

export const templateReportService = new TemplateReportService();
