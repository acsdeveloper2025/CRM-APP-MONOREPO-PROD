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

export interface VerificationReportData {
  verificationType: string;
  outcome: string;
  formData: any;
  caseDetails: {
    caseId: string;
    customerName: string;
    address: string;
  };
}

export class TemplateReportService {
  private readonly RESIDENCE_TEMPLATES = {
    'POSITIVE': `Residence Remark: POSITIVE.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is traceable and {Address_Locatable}. Address locality is {Address_Rating}. At the time of visit met with {Met_Person_Name} ({Met_Person_Relation}), confirmed {Customer_Name} stay and provide the details and also confirmed {Customer_Name} is staying at given address since {Staying_Period} {Staying_Status}.

PROPERTY & PERSONAL DETAILS:
The area of premises is approx. {Approx_Area_Sq_Feet}. Total family members are {Total_Family_Members} and earning members are {Total_Earning}. {Customer_Name} works as {Working_Status} at {Company_Name}. The door name plate is {Door_Name_Plate} {Name_on_Door_Plate} and also name on Society board is {Society_Name_Plate} {Name_on_Society_Board}.

LOCALITY INFORMATION:
Locality is Residential & type of locality is {Locality}. {Locality} is of {Address_Structure_G_Plus} and {Customer_Name} is staying on {Applicant_Staying_Floor} floor. {Locality} color is {Address_Structure_Color}. The Door color is {Door_Color}. Residence set up is sighted at the time of visit. During visit met person shown {Document_Type}.

THIRD PARTY CONFIRMATION:
TPC {TPC_Met_Person_1} {Name_of_TPC_1} {TPC_Confirmation_1} {Customer_Name} name and stay. TPC {TPC_Met_Person_2} {Name_of_TPC_2} {TPC_Confirmation_2} {Customer_Name} name and stay.

AREA ASSESSMENT:
Landmarks: {Landmark_1} and {Landmark_2}. It is {Dominated_Area} area. {Feedback_from_Neighbour} feedback received from neighbors. Field executive also confirmed {Customer_Name} is {Political_Connection}. {Customer_Name} stay is confirmed by our executive's observation as well as from TPC.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    'POSITIVE_DOOR_LOCKED': `Residence Remark: POSITIVE & DOOR LOCKED.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is traceable and {Address_Locatable}. Address locality is {Address_Rating}. At the time of visit door was {House_Status}.

THIRD PARTY CONFIRMATION:
TPC done with {TPC_Met_Person_1} {Name_of_TPC_1} who {TPC_Confirmation_1} {Customer_Name} name and stay. TPC {TPC_Met_Person_2} {Name_of_TPC_2} also {TPC_Confirmation_2} {Customer_Name} name and stay. Confirmed {Customer_Name} is staying at given address since {Staying_Period} {Staying_Status}.

PROPERTY & PERSONAL DETAILS:
The area of premises is approx. {Approx_Area_Sq_Feet}. Total family members are {Total_Family_Members} and earning members are {Total_Earning}. {Customer_Name} works as {Working_Status} at {Company_Name}. The door name plate is {Door_Name_Plate} {Name_on_Door_Plate} and also name on Society board is {Society_Name_Plate} {Name_on_Society_Board}.

LOCALITY INFORMATION:
Locality is Residential & type of locality is {Locality}. {Locality} is of {Address_Structure_G_Plus} and {Customer_Name} is staying on {Applicant_Staying_Floor} floor. {Locality} color is {Address_Structure_Color}. The Door color is {Door_Color}. Residence set up is sighted at the time of visit. During visit met person shown {Document_Type}.

AREA ASSESSMENT:
Landmarks: {Landmark_1} and {Landmark_2}. It is {Dominated_Area} area. {Feedback_from_Neighbour} feedback received from neighbors. Field executive also confirmed {Customer_Name} is {Political_Connection}. {Customer_Name} stay is confirmed by our executive's observation as well as from TPC.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    'SHIFTED': `Residence Remark: SHIFTED.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is traceable and {Address_Locatable}. Address locality is {Address_Rating}. At the time of visit door was {House_Status}. Met with {Met_Person_Name} ({Met_Person_Relation}) informed that {Customer_Name} is shifted to another address since last {Shifted_Period}.

PROPERTY DETAILS:
The door name plate is {Door_Name_Plate_Status} {Name_on_Door_Plate} and also name on Society board is {Society_Name_Plate_Status} {Name_on_Society_Board}. At present given premises is {Premises_Status}.

LOCALITY INFORMATION:
Locality is Residential & type of locality is {Locality_Type}. {Locality_Type} is of {Address_Structure} and address located on {Address_Floor} floor. {Locality_Type} color is {Address_Structure_Color}. The Door color is {Door_Color}.

THIRD PARTY CONFIRMATION:
TPC done with {TPC_Met_Person_1} {Name_of_TPC_1} and {TPC_Met_Person_2} {Name_of_TPC_2} they have informed that {Customer_Name} is shifted from the given address.

AREA ASSESSMENT:
It's a {Dominated_Area} area. Landmarks: {Landmark_1} and {Landmark_2}. {Feedback_From_Neighbour} feedback received from neighbors. Field executive also confirmed {Customer_Name} is {Political_Connection}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    'SHIFTED_DOOR_LOCKED': `Residence Remark: SHIFTED & DOOR LOCKED.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is traceable and {Address_Locatable}. Address locality is {Address_Rating}. At the time of visit door was {House_Status}.

THIRD PARTY CONFIRMATION:
TPC done with {TPC_Met_Person_1} {Name_of_TPC_1} and {TPC_Met_Person_2} {Name_of_TPC_2} they have informed that {Customer_Name} is shifted from the given address from last {Shifted_Period}.

PROPERTY DETAILS:
At present given premises is {Premises_Status}. The door name plate is {Door_Name_Plate_Status} {Name_on_Door_Plate} and also Society board is {Society_Name_Plate_Status} {Name_on_Society_Board}.

LOCALITY INFORMATION:
Locality is Residential & type of locality is {Locality_Type}. {Locality_Type} is of {Address_Structure} and address located on {Address_Floor} floor. {Locality_Type} color is {Address_Structure_Color}. The Door color is {Door_Color}.

AREA ASSESSMENT:
It's a {Dominated_Area} area. Landmarks: {Landmark_1} and {Landmark_2}. {Feedback_From_Neighbour} feedback received from neighbors. Field executive also confirmed {Customer_Name} is {Political_Connection}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    'ERT': `Residence Entry Restricted Remark (ERT):-
Visited at the given address {ADDRESS}. The given address is traceable and {Address_Locatable}. Address locality is {Address_Rating}. It is {Customer_Name} address. At the time of visit met with {Met_Person_Name} {Name_of_Met_Person} informed that in given premises entry is not allowed. {Met_Person_Name} {Met_Person_Confirmation} {Applicant_Staying_Status} given address. Society board is {Society_Name_Plate_Status} {Name_on_Society_Board}. Locality is Residential & type of locality is {Locality_Type}.
{Locality_Type} is of {Address_Structure} and address located on {Applicant_Staying_Floor}.
{Locality_Type} color is {Address_Structure_Color}.
It's a {Address_Structure_Color} area.
Landmarks: {Landmark_1} and {Landmark_2}.
{Feedback_from_Neighbour} feedback received from met person.
Also executive confirmed about customer {Feedback_from_Neighbour}.
Field Executive Observation :- {Other_Observation}
Hence the profile is marked as {Final_Status}`,

    'UNTRACEABLE': `Residence Untraceable Remark (UT):-
Visited at the given address {ADDRESS}. The given address is incorrect and untraceable. At the time of visit met with {Met_Person_Name}, Met person informed that provided address is short. We called {Customer_Name} but {Customer_Name} {Call_Remark}. We required proper guidance to trace the address. Type of Locality is {Locality_Type}. Field executive reached up to {Landmark_1}, {Landmark_2}, {Landmark_3}, {Landmark_4}. It's a {Dominated_Area} area.
Field Executive Observation :- {Other_Observation}.
Hence the profile is marked as {Final_Status}.`,

    'NSP': `Residence Remark: NSP (No Such Person).

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is traceable and {Address_Locatable}. Address locality is {Address_Rating}. At the time of visit door was {House_Status}. Met with {Met_Person_Name} ({Met_Person_Status}) informed that there is no such person staying at given address.

CURRENT RESIDENT INFORMATION:
Met person staying at given address from last {Staying_Period}. As per current resident, {Customer_Name} has never stayed at this address.

PROPERTY DETAILS:
The door name plate is {Door_Name_Plate_Status} {Name_on_Door_Plate} and Society board is {Society_Name_Plate_Status} {Name_on_Society_Board}.

LOCALITY INFORMATION:
Locality is Residential & type of locality is {Locality_Type}. {Locality_Type} is of {Address_Structure} and address is on {Applicant_Staying_Floor} floor. {Locality_Type} color is {Address_Structure_Color}. The Door color is {Door_Color}.

THIRD PARTY CONFIRMATION:
TPC done with {TPC_Met_Person_1} {Name_of_TPC_1} and {TPC_Met_Person_2} {Name_of_TPC_2} they have informed there is no such person staying at given address.

AREA ASSESSMENT:
Landmarks: {Landmark_1} and {Landmark_2}. It's a {Dominated_Area} area. Applicant's stability is not confirmed from our executive's observation as well as from TPC.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    'NSP_DOOR_LOCKED': `Residence Remark: NSP & DOOR LOCKED.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is traceable and {Address_Locatable}. Address locality is {Address_Rating}. At the time of visit door was {House_Status}.

THIRD PARTY CONFIRMATION:
TPC done with {TPC_Met_Person_1} {Name_of_TPC_1} and {TPC_Met_Person_2} {Name_of_TPC_2} they have informed that there is no such person staying at given address. As per TPC confirmation {Staying_Person_Name} is staying at given address.

PROPERTY DETAILS:
The door name plate is {Door_Name_Plate_Status} {Name_on_Door_Plate} and a Society board is {Society_Name_Plate_Status} {Name_on_Society_Board}.

LOCALITY INFORMATION:
Locality is Residential & type of locality is {Locality_Type}. {Locality_Type} is of {Address_Structure} and the address is on {Applicant_Staying_Floor} floor. {Locality_Type} color is {Address_Structure_Color}. The Door color is {Door_Color}.

AREA ASSESSMENT:
Landmarks: {Landmark_1} and {Landmark_2}. It's a {Dominated_Area} area. Applicant's stability is not confirmed from our executive's observation as well as from TPC.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`
  };

  private readonly OFFICE_TEMPLATES = {
    'POSITIVE': `Office Remark: POSITIVE.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is traceable and {Address_Locatable}. Address locality is {Address_Rating}. At the time of visit office was {Office_Status}. Met with {Met_Person_Name} ({Designation}), confirmed {Customer_Name} is working in given office since last {Working_Period} as {Applicant_Designation}.

EMPLOYMENT & OFFICE DETAILS:
{Customer_Name} working on {Applicant_Designation} & sitting at {Applicant_Working_Premises} {Sitting_Location}. It's a {Office_Type} and nature of business is {Company_Nature_Of_Business}. Total strength of the staff is {Staff_Strength} & seen {Staff_Seen}. Office area approx. {Office_Approx_Area} sq. feet. Company Name board {Company_Name_Plate} {Name_On_Board}.

LOCALITY INFORMATION:
Locality is {Locality}. {Locality} is of {Address_Structure}. {Locality} color is {Address_Structure_Color} and Door color is {Door_Color}.

THIRD PARTY CONFIRMATION:
TPC done with {TPC_Met_Person_1} {Name_of_TPC_1} {TPC_Confirmation_1} and {TPC_Met_Person_2} {Name_of_TPC_2} {TPC_Confirmation_2} {Customer_Name} & office existence.

AREA ASSESSMENT:
It is {Dominated_Area} area. Landmarks: {Landmark_1} and {Landmark_2}. {Feedback_From_Neighbour} feedback found against {Customer_Name} & his firm. Field executive also confirmed {Customer_Name} is {Political_Connection}. {Customer_Name} stability is confirmed by our executive's observation as well as from TPC.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    'POSITIVE_DOOR_LOCKED': `Office Remark: POSITIVE & DOOR LOCKED.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is traceable and {Address_Locatable}. Address locality is {Address_Rating}. At the time of visit office was {Office_Status}.

THIRD PARTY CONFIRMATION:
TPC done with {TPC_Met_Person_1} {Name_of_TPC_1} {TPC_Confirmation_1} and {TPC_Met_Person_2} {Name_of_TPC_2} {TPC_Confirmation_2} {Customer_Name} & office existence. They informed that given office at given address since last {Working_Period}.

OFFICE & COMPANY DETAILS:
Company Name board {Company_Name_Plate} {Name_On_Board}. Office area approx. {Office_Approx_Area} sq. feet. Nature of business is {Company_Nature_Of_Business}.

LOCALITY INFORMATION:
Locality is {Locality}. {Locality} is of {Address_Structure}. {Locality} color is {Address_Structure_Color} and Door color is {Door_Color}.

AREA ASSESSMENT:
It is {Dominated_Area} area. Landmarks: {Landmark_1} and {Landmark_2}. {Feedback_From_Neighbour} feedback received from neighbors. Field executive also confirmed {Customer_Name} is {Political_Connection}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    'SHIFTED': `Office Remark: SHIFTED.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is traceable and {Address_Locatable}. Address locality is {Address_Rating}. At the time of visit office was {Office_Status}. Met with {Met_Person_Name} ({Designation}) confirmed that company shifted from the given address {Old_Office_Shifted_Period} ago.

CURRENT OFFICE STATUS:
{Current_Company_Name} Company operating business at given address from last {Current_Company_Period}. Company name board is {Company_Name_Plate} {Name_On_Board}.

LOCALITY INFORMATION:
Locality is {Locality}. {Locality} is of {Address_Structure}. {Locality} color is {Address_Structure_Color} and Door color is {Door_Color}.

THIRD PARTY CONFIRMATION:
TPC done with {TPC_Met_Person_1} {Name_of_TPC_1} and {TPC_Met_Person_2} {Name_of_TPC_2} they confirmed that company is shifted from the given address on {Old_Office_Shifted_Period} ago.

AREA ASSESSMENT:
It is {Dominated_Area} area. Landmarks: {Landmark_1} and {Landmark_2}. {Feedback_From_Neighbour} feedback received from neighbors. Field executive also confirmed {Customer_Name} is {Political_Connection}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    'SHIFTED_DOOR_LOCKED': `Office Remark: SHIFTED & DOOR LOCKED.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is traceable and {Address_Locatable}. Address locality is {Address_Rating}. At the time of visit office was {Office_Status}.

THIRD PARTY CONFIRMATION:
TPC done with {TPC_Met_Person_1} {Name_of_TPC_1} and {TPC_Met_Person_2} {Name_of_TPC_2} they confirmed that company shifted from the given address {Old_Office_Shifted_Period} ago.

CURRENT OFFICE STATUS:
{Current_Company_Name} Company operating business at given address. Company name board is {Company_Name_Plate} {Name_On_Board}.

LOCALITY INFORMATION:
Locality is {Locality}. {Locality} is of {Address_Structure}. {Locality} color is {Address_Structure_Color} and Door color is {Door_Color}.

AREA ASSESSMENT:
It is {Dominated_Area} area. Landmarks: {Landmark_1} and {Landmark_2}. {Feedback_From_Neighbour} feedback from neighbors. Field executive also confirmed {Customer_Name} is {Political_Connection}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    'ERT': `Office Entry Restricted Remark (ERT):-

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is traceable and {Address_Locatable}. Address locality is {Address_Rating}. It is {Customer_Name} address. At the time of visit met with {Met_Person_Type} {Name_Of_Met_Person} informed that given premises entry not allowed.

ENTRY RESTRICTION DETAILS:
{Met_Person_Type} {Met_Person_Confirmation} {Office_Status} given address. Entry is restricted due to security protocols or company policies.

LOCALITY INFORMATION:
Locality is {Locality}. {Locality} is of {Locality} and address located on {Office_Exist_Floor} floor. {Locality} color is {Address_Structure_Color}.

AREA ASSESSMENT:
It's a {Dominated_Area} area. Landmarks: {Landmark_1} and {Landmark_2}. {Feedback_From_Neighbour} feedback received from neighbors. Field executive also confirmed {Customer_Name} is {Political_Connection}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    'UNTRACEABLE': `Office Untraceable Remark (UT):-

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is incorrect and untraceable. At the time of visit met with {Met_Person_Name}, Met person informed that provided address is short.

CONTACT ATTEMPT:
We called {Customer_Name} but {Customer_Name} {Call_Remark}. We required proper guidance to trace the address.

SEARCH EFFORTS:
Type of Locality is {Locality}. Field executive reached up to {Landmark_1}, {Landmark_2}, {Landmark_3}, {Landmark_4}. It's a {Dominated_Area} area.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    'NSP': `Office Remark: NSP (No Such Person).

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is traceable and {Address_Locatable}. Address locality is {Address_Rating}. At the time of visit office was {Office_Status}. Met with {Met_Person_Name} ({Designation}).

EMPLOYMENT VERIFICATION:
Met person informed that there is no such person working at given address. As per current office staff, {Customer_Name} has never worked at this office.

OFFICE DETAILS:
Company name board is {Company_Name_Plate} {Name_On_Board}. Office area approx. {Office_Approx_Area} sq. feet.

LOCALITY INFORMATION:
Locality is {Locality}. {Locality} is of {Address_Structure}. {Locality} color is {Address_Structure_Color} and Door color is {Door_Color}.

THIRD PARTY CONFIRMATION:
TPC done with {TPC_Met_Person_1} {Name_of_TPC_1} and {TPC_Met_Person_2} {Name_of_TPC_2} {Third_Party_Confirmation} there is no such person working at given address.

AREA ASSESSMENT:
It is {Dominated_Area} area. Landmarks: {Landmark_1} and {Landmark_2}. {Feedback_From_Neighbour} feedback received from neighbors. Applicant's stability is not confirmed by our executive's observation as well as from TPC.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    'NSP_DOOR_LOCKED': `Office Remark: NSP & DOOR LOCKED.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is traceable and {Address_Locatable}. Address locality is {Address_Rating}. At the time of visit office was {Office_Status}.

THIRD PARTY CONFIRMATION:
TPC done with {TPC_Met_Person_1} {Name_of_TPC_1} {TPC_Confirmation_1} and {TPC_Met_Person_2} {Name_of_TPC_2} {TPC_Confirmation_2} Office {Office_Existence} at given address. As per TPC confirmation, there is no such person working at this office.

CURRENT OFFICE STATUS:
{Current_Company_Name} Company operating business at given address. Company name board is {Company_Name_Plate} {Name_On_Board}.

LOCALITY INFORMATION:
Locality is {Locality}. {Locality} is of {Address_Structure}. {Locality} color is {Address_Structure_Color} and Door color is {Door_Color}.

AREA ASSESSMENT:
It is {Dominated_Area} area. Landmarks: {Landmark_1} and {Landmark_2}. {Feedback_From_Neighbour} feedback received from neighbors. Applicant's stability is not confirmed by our executive's observation as well as from TPC.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`
  };

  private readonly BUSINESS_TEMPLATES = {
    'POSITIVE': `Business Remark: POSITIVE.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is traceable and {Address_Locatable}. Address locality is {Address_Rating}. At the time of visit business was {Business_Status}. Met with {Met_Person_Name} ({Designation}), confirmed {Customer_Name} is running business at given address since last {Business_Period}.

BUSINESS & ESTABLISHMENT DETAILS:
Business type is {Business_Type} and nature of business is {Company_Nature_Of_Business}. Business area approx. {Business_Approx_Area} sq. feet. Business establishment period is {Establishment_Period}. Business owner name is {Business_Owner_Name}. Company Name board {Company_Name_Plate} {Name_On_Board}.

BUSINESS OPERATIONS:
Business activity includes {Business_Activity}. Business setup is {Business_Setup}. Total staff strength is {Staff_Strength} & seen {Staff_Seen}. Business existence confirmed as {Business_Existence}.

LOCALITY INFORMATION:
Locality is {Locality}. {Locality} is of {Address_Structure}. {Locality} color is {Address_Structure_Color} and Door color is {Door_Color}.

THIRD PARTY CONFIRMATION:
TPC done with {TPC_Met_Person_1} {Name_of_TPC_1} {TPC_Confirmation_1} and {TPC_Met_Person_2} {Name_of_TPC_2} {TPC_Confirmation_2} {Customer_Name} & business existence.

AREA ASSESSMENT:
It is {Dominated_Area} area. Landmarks: {Landmark_1} and {Landmark_2}. {Feedback_From_Neighbour} feedback found against {Customer_Name} & his business. Field executive also confirmed {Customer_Name} is {Political_Connection}. {Customer_Name} business stability is confirmed by our executive's observation as well as from TPC.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    'POSITIVE_DOOR_LOCKED': `Business Remark: POSITIVE & DOOR LOCKED.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is traceable and {Address_Locatable}. Address locality is {Address_Rating}. At the time of visit business was {Business_Status}.

THIRD PARTY CONFIRMATION:
TPC done with {TPC_Met_Person_1} {Name_of_TPC_1} {TPC_Confirmation_1} and {TPC_Met_Person_2} {Name_of_TPC_2} {TPC_Confirmation_2} {Customer_Name} & business existence. They informed that given business at given address since last {Business_Period}.

BUSINESS & ESTABLISHMENT DETAILS:
Business type is {Business_Type} and nature of business is {Company_Nature_Of_Business}. Business area approx. {Business_Approx_Area} sq. feet. Business establishment period is {Establishment_Period}. Company Name board {Company_Name_Plate} {Name_On_Board}.

LOCALITY INFORMATION:
Locality is {Locality}. {Locality} is of {Address_Structure}. {Locality} color is {Address_Structure_Color} and Door color is {Door_Color}.

AREA ASSESSMENT:
It is {Dominated_Area} area. Landmarks: {Landmark_1} and {Landmark_2}. {Feedback_From_Neighbour} feedback received from neighbors. Field executive also confirmed {Customer_Name} is {Political_Connection}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    'SHIFTED': `Business Remark: SHIFTED.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is traceable and {Address_Locatable}. Address locality is {Address_Rating}. At the time of visit business was {Business_Status}. Met with {Met_Person_Name} ({Designation}) confirmed that business shifted from the given address {Old_Business_Shifted_Period} ago.

CURRENT BUSINESS STATUS:
{Current_Company_Name} business operating at given address from last {Current_Company_Period}. Company name board is {Company_Name_Plate} {Name_On_Board}.

LOCALITY INFORMATION:
Locality is {Locality}. {Locality} is of {Address_Structure}. {Locality} color is {Address_Structure_Color} and Door color is {Door_Color}.

THIRD PARTY CONFIRMATION:
TPC done with {TPC_Met_Person_1} {Name_of_TPC_1} and {TPC_Met_Person_2} {Name_of_TPC_2} they confirmed that business is shifted from the given address.

AREA ASSESSMENT:
It is {Dominated_Area} area. Landmarks: {Landmark_1} and {Landmark_2}. {Feedback_From_Neighbour} feedback received from neighbors. Field executive also confirmed {Customer_Name} is {Political_Connection}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    'SHIFTED_DOOR_LOCKED': `Business Remark: SHIFTED & DOOR LOCKED.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is traceable and {Address_Locatable}. Address locality is {Address_Rating}. At the time of visit business was {Business_Status}.

THIRD PARTY CONFIRMATION:
TPC done with {TPC_Met_Person_1} {Name_of_TPC_1} and {TPC_Met_Person_2} {Name_of_TPC_2} they confirmed that business shifted from the given address {Old_Business_Shifted_Period} ago.

CURRENT BUSINESS STATUS:
{Current_Company_Name} business operating at given address. Company name board is {Company_Name_Plate} {Name_On_Board}.

LOCALITY INFORMATION:
Locality is {Locality}. {Locality} is of {Address_Structure}. {Locality} color is {Address_Structure_Color} and Door color is {Door_Color}.

AREA ASSESSMENT:
It is {Dominated_Area} area. Landmarks: {Landmark_1} and {Landmark_2}. {Feedback_From_Neighbour} feedback from neighbors. Field executive also confirmed {Customer_Name} is {Political_Connection}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    'NSP': `Business Remark: NSP (No Such Person).

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is traceable and {Address_Locatable}. Address locality is {Address_Rating}. At the time of visit business was {Business_Status}. Met with {Met_Person_Name} ({Designation}).

BUSINESS VERIFICATION:
Met person informed that there is no such person running business at given address. As per current business owner, {Customer_Name} has never operated business at this address.

CURRENT BUSINESS DETAILS:
Company name board is {Company_Name_Plate} {Name_On_Board}. Business area approx. {Business_Approx_Area} sq. feet.

LOCALITY INFORMATION:
Locality is {Locality}. {Locality} is of {Address_Structure}. {Locality} color is {Address_Structure_Color} and Door color is {Door_Color}.

THIRD PARTY CONFIRMATION:
TPC done with {TPC_Met_Person_1} {Name_of_TPC_1} and {TPC_Met_Person_2} {Name_of_TPC_2} {Third_Party_Confirmation} there is no such person running business at given address.

AREA ASSESSMENT:
It is {Dominated_Area} area. Landmarks: {Landmark_1} and {Landmark_2}. {Feedback_From_Neighbour} feedback received from neighbors. Applicant's business stability is not confirmed by our executive's observation as well as from TPC.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    'NSP_DOOR_LOCKED': `Business Remark: NSP & DOOR LOCKED.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is traceable and {Address_Locatable}. Address locality is {Address_Rating}. At the time of visit business was {Business_Status}.

THIRD PARTY CONFIRMATION:
TPC done with {TPC_Met_Person_1} {Name_of_TPC_1} {TPC_Confirmation_1} and {TPC_Met_Person_2} {Name_of_TPC_2} {TPC_Confirmation_2} Business {Business_Existence} at given address. As per TPC confirmation, there is no such person running business at this address.

CURRENT BUSINESS STATUS:
{Current_Company_Name} business operating at given address. Company name board is {Company_Name_Plate} {Name_On_Board}.

LOCALITY INFORMATION:
Locality is {Locality}. {Locality} is of {Address_Structure}. {Locality} color is {Address_Structure_Color} and Door color is {Door_Color}.

AREA ASSESSMENT:
It is {Dominated_Area} area. Landmarks: {Landmark_1} and {Landmark_2}. {Feedback_From_Neighbour} feedback received from neighbors. Applicant's business stability is not confirmed by our executive's observation as well as from TPC.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    'ERT': `Business Entry Restricted Remark (ERT):-

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is traceable and {Address_Locatable}. Address locality is {Address_Rating}. It is {Customer_Name} business address. At the time of visit met with {Met_Person_Type} {Name_Of_Met_Person} informed that given premises entry not allowed.

ENTRY RESTRICTION DETAILS:
{Met_Person_Type} {Met_Person_Confirmation} {Business_Status} given address. Entry is restricted due to security protocols or business policies.

LOCALITY INFORMATION:
Locality is {Locality}. {Locality} is of {Locality} and address located on {Office_Exist_Floor} floor. {Locality} color is {Address_Structure_Color}.

AREA ASSESSMENT:
It's a {Dominated_Area} area. Landmarks: {Landmark_1} and {Landmark_2}. {Feedback_From_Neighbour} feedback received from neighbors. Field executive also confirmed {Customer_Name} is {Political_Connection}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    'UNTRACEABLE': `Business Untraceable Remark (UT):-

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is incorrect and untraceable. At the time of visit met with {Met_Person_Name}, Met person informed that provided address is short.

CONTACT ATTEMPT:
We called {Customer_Name} but {Customer_Name} {Call_Remark}. We required proper guidance to trace the address.

SEARCH EFFORTS:
Type of Locality is {Locality}. Field executive reached up to {Landmark_1}, {Landmark_2}, {Landmark_3}, {Landmark_4}. It's a {Dominated_Area} area.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`
  };

  private readonly RESIDENCE_CUM_OFFICE_TEMPLATES = {
    'POSITIVE': `Residence-cum-Office Remark: POSITIVE.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is traceable and {Address_Locatable}. Address locality is {Address_Rating}. At the time of visit residence was {House_Status} and office was {Office_Status}. Met with {Met_Person_Name} ({Met_Person_Relation}), confirmed {Customer_Name} is staying and working at given address since last {Staying_Period}.

RESIDENCE VERIFICATION:
{Customer_Name} is staying at given address since last {Staying_Period} as {Staying_Status}. Total family members are {Total_Family_Members}. House area approx. {Approx_Area} sq. feet. Ownership status is {Ownership_Status}.

OFFICE VERIFICATION:
{Customer_Name} is working at given address since last {Working_Period} as {Applicant_Designation}. Office type is {Office_Type} and nature of business is {Company_Nature_Of_Business}. Office area approx. {Office_Approx_Area} sq. feet.

PROPERTY DETAILS:
Name plate status: Door {Door_Name_Plate_Status} {Name_On_Door_Plate}, Society {Society_Name_Plate_Status} {Name_On_Society_Board}, Company {Company_Name_Plate} {Name_On_Board}.

LOCALITY INFORMATION:
Locality is {Locality}. {Locality} is of {Address_Structure} and address located on {Address_Floor} floor. {Locality} color is {Address_Structure_Color} and Door color is {Door_Color}.

THIRD PARTY CONFIRMATION:
TPC done with {TPC_Met_Person_1} {Name_of_TPC_1} {TPC_Confirmation_1} and {TPC_Met_Person_2} {Name_of_TPC_2} {TPC_Confirmation_2} {Customer_Name} residence & office existence.

AREA ASSESSMENT:
It is {Dominated_Area} area. Landmarks: {Landmark_1} and {Landmark_2}. {Feedback_From_Neighbour} feedback received from neighbors. Field executive also confirmed {Customer_Name} is {Political_Connection}. {Customer_Name} residence & office stability is confirmed by our executive's observation as well as from TPC.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    'POSITIVE_DOOR_LOCKED': `Residence-cum-Office Remark: POSITIVE & DOOR LOCKED.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is traceable and {Address_Locatable}. Address locality is {Address_Rating}. At the time of visit residence was {House_Status} and office was {Office_Status}.

THIRD PARTY CONFIRMATION:
TPC done with {TPC_Met_Person_1} {Name_of_TPC_1} {TPC_Confirmation_1} and {TPC_Met_Person_2} {Name_of_TPC_2} {TPC_Confirmation_2} {Customer_Name} residence & office existence. They informed that {Customer_Name} is staying and working at given address since last {Staying_Period}.

RESIDENCE & OFFICE DETAILS:
{Customer_Name} is staying and working at given address. Total family members are {Total_Family_Members}. House area approx. {Approx_Area} sq. feet. Office area approx. {Office_Approx_Area} sq. feet.

PROPERTY DETAILS:
Name plate status: Door {Door_Name_Plate_Status} {Name_On_Door_Plate}, Society {Society_Name_Plate_Status} {Name_On_Society_Board}, Company {Company_Name_Plate} {Name_On_Board}.

LOCALITY INFORMATION:
Locality is {Locality}. {Locality} is of {Address_Structure} and address located on {Address_Floor} floor. {Locality} color is {Address_Structure_Color} and Door color is {Door_Color}.

AREA ASSESSMENT:
It is {Dominated_Area} area. Landmarks: {Landmark_1} and {Landmark_2}. {Feedback_From_Neighbour} feedback received from neighbors. Field executive also confirmed {Customer_Name} is {Political_Connection}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    'SHIFTED': `Residence-cum-Office Remark: SHIFTED.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is traceable and {Address_Locatable}. Address locality is {Address_Rating}. At the time of visit residence was {House_Status} and office was {Office_Status}. Met with {Met_Person_Name} ({Met_Person_Relation}) confirmed that {Customer_Name} shifted from the given address {Shifted_Period} ago.

CURRENT STATUS:
{Staying_Person_Name} is currently staying at given address. {Current_Company_Name} office operating at given address from last {Current_Company_Period}.

PROPERTY DETAILS:
Name plate status: Door {Door_Name_Plate_Status} {Name_On_Door_Plate}, Society {Society_Name_Plate_Status} {Name_On_Society_Board}, Company {Company_Name_Plate} {Name_On_Board}.

LOCALITY INFORMATION:
Locality is {Locality}. {Locality} is of {Address_Structure} and address located on {Address_Floor} floor. {Locality} color is {Address_Structure_Color} and Door color is {Door_Color}.

THIRD PARTY CONFIRMATION:
TPC done with {TPC_Met_Person_1} {Name_of_TPC_1} and {TPC_Met_Person_2} {Name_of_TPC_2} they confirmed that {Customer_Name} shifted from the given address.

AREA ASSESSMENT:
It is {Dominated_Area} area. Landmarks: {Landmark_1} and {Landmark_2}. {Feedback_From_Neighbour} feedback received from neighbors. Field executive also confirmed {Customer_Name} is {Political_Connection}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    'SHIFTED_DOOR_LOCKED': `Residence-cum-Office Remark: SHIFTED & DOOR LOCKED.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is traceable and {Address_Locatable}. Address locality is {Address_Rating}. At the time of visit residence was {House_Status} and office was {Office_Status}.

THIRD PARTY CONFIRMATION:
TPC done with {TPC_Met_Person_1} {Name_of_TPC_1} and {TPC_Met_Person_2} {Name_of_TPC_2} they confirmed that {Customer_Name} shifted from the given address {Shifted_Period} ago.

CURRENT STATUS:
{Staying_Person_Name} is currently staying at given address. {Current_Company_Name} office operating at given address.

PROPERTY DETAILS:
Name plate status: Door {Door_Name_Plate_Status} {Name_On_Door_Plate}, Society {Society_Name_Plate_Status} {Name_On_Society_Board}, Company {Company_Name_Plate} {Name_On_Board}.

LOCALITY INFORMATION:
Locality is {Locality}. {Locality} is of {Address_Structure} and address located on {Address_Floor} floor. {Locality} color is {Address_Structure_Color} and Door color is {Door_Color}.

AREA ASSESSMENT:
It is {Dominated_Area} area. Landmarks: {Landmark_1} and {Landmark_2}. {Feedback_From_Neighbour} feedback from neighbors. Field executive also confirmed {Customer_Name} is {Political_Connection}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    'NSP': `Residence-cum-Office Remark: NSP (No Such Person).

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is traceable and {Address_Locatable}. Address locality is {Address_Rating}. At the time of visit residence was {House_Status} and office was {Office_Status}. Met with {Met_Person_Name} ({Met_Person_Relation}).

RESIDENCE & OFFICE VERIFICATION:
Met person informed that there is no such person staying or working at given address. As per current residents and office staff, {Customer_Name} has never stayed or worked at this address.

CURRENT STATUS:
{Staying_Person_Name} is currently staying at given address. Current office details: Company {Company_Name_Plate} {Name_On_Board}.

LOCALITY INFORMATION:
Locality is {Locality}. {Locality} is of {Address_Structure} and address located on {Address_Floor} floor. {Locality} color is {Address_Structure_Color} and Door color is {Door_Color}.

THIRD PARTY CONFIRMATION:
TPC done with {TPC_Met_Person_1} {Name_of_TPC_1} and {TPC_Met_Person_2} {Name_of_TPC_2} {Third_Party_Confirmation} there is no such person staying or working at given address.

AREA ASSESSMENT:
It is {Dominated_Area} area. Landmarks: {Landmark_1} and {Landmark_2}. {Feedback_From_Neighbour} feedback received from neighbors. Applicant's residence & office stability is not confirmed by our executive's observation as well as from TPC.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    'NSP_DOOR_LOCKED': `Residence-cum-Office Remark: NSP & DOOR LOCKED.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is traceable and {Address_Locatable}. Address locality is {Address_Rating}. At the time of visit residence was {House_Status} and office was {Office_Status}.

THIRD PARTY CONFIRMATION:
TPC done with {TPC_Met_Person_1} {Name_of_TPC_1} {TPC_Confirmation_1} and {TPC_Met_Person_2} {Name_of_TPC_2} {TPC_Confirmation_2} Residence & Office existence at given address. As per TPC confirmation, there is no such person staying or working at this address.

CURRENT STATUS:
Current residents and office operating at given address. Company {Company_Name_Plate} {Name_On_Board}.

LOCALITY INFORMATION:
Locality is {Locality}. {Locality} is of {Address_Structure} and address located on {Address_Floor} floor. {Locality} color is {Address_Structure_Color} and Door color is {Door_Color}.

AREA ASSESSMENT:
It is {Dominated_Area} area. Landmarks: {Landmark_1} and {Landmark_2}. {Feedback_From_Neighbour} feedback received from neighbors. Applicant's residence & office stability is not confirmed by our executive's observation as well as from TPC.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    'ERT': `Residence-cum-Office Entry Restricted Remark (ERT):-

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is traceable and {Address_Locatable}. Address locality is {Address_Rating}. It is {Customer_Name} residence-cum-office address. At the time of visit met with {Met_Person_Type} {Name_Of_Met_Person} informed that given premises entry not allowed.

ENTRY RESTRICTION DETAILS:
{Met_Person_Type} {Met_Person_Confirmation} residence & office existence at given address. Entry is restricted due to security protocols or building policies.

LOCALITY INFORMATION:
Locality is {Locality}. {Locality} is of {Locality} and address located on {Office_Exist_Floor} floor. {Locality} color is {Address_Structure_Color}.

AREA ASSESSMENT:
It's a {Dominated_Area} area. Landmarks: {Landmark_1} and {Landmark_2}. {Feedback_From_Neighbour} feedback received from neighbors. Field executive also confirmed {Customer_Name} is {Political_Connection}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    'UNTRACEABLE': `Residence-cum-Office Untraceable Remark (UT):-

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is incorrect and untraceable. At the time of visit met with {Met_Person_Name}, Met person informed that provided address is short.

CONTACT ATTEMPT:
We called {Customer_Name} but {Customer_Name} {Call_Remark}. We required proper guidance to trace the address.

SEARCH EFFORTS:
Type of Locality is {Locality}. Field executive reached up to {Landmark_1}, {Landmark_2}, {Landmark_3}, {Landmark_4}. It's a {Dominated_Area} area.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`
  };

  private readonly BUILDER_TEMPLATES = {
    'POSITIVE': `Builder Remark: POSITIVE.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is traceable and {Address_Locatable}. Address locality is {Address_Rating}. At the time of visit builder office was {Office_Status}. Met with {Met_Person_Name} ({Designation}), confirmed {Customer_Name} is working as builder at given address since last {Working_Period}.

BUILDER & PROJECT DETAILS:
Builder type is {Business_Type} and nature of business is {Company_Nature_Of_Business}. Office area approx. {Office_Approx_Area} sq. feet. Builder establishment period is {Establishment_Period}. Current projects include {Business_Activity}. Company Name board {Company_Name_Plate} {Name_On_Board}.

LOCALITY INFORMATION:
Locality is {Locality}. {Locality} is of {Address_Structure}. {Locality} color is {Address_Structure_Color} and Door color is {Door_Color}.

THIRD PARTY CONFIRMATION:
TPC done with {TPC_Met_Person_1} {Name_of_TPC_1} {TPC_Confirmation_1} and {TPC_Met_Person_2} {Name_of_TPC_2} {TPC_Confirmation_2} {Customer_Name} & builder office existence.

AREA ASSESSMENT:
It is {Dominated_Area} area. Landmarks: {Landmark_1} and {Landmark_2}. {Feedback_From_Neighbour} feedback received from neighbors. Field executive also confirmed {Customer_Name} is {Political_Connection}. {Customer_Name} builder stability is confirmed by our executive's observation as well as from TPC.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    'POSITIVE_DOOR_LOCKED': `Builder Remark: POSITIVE & DOOR LOCKED.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is traceable and {Address_Locatable}. Address locality is {Address_Rating}. At the time of visit builder office was {Office_Status}.

THIRD PARTY CONFIRMATION:
TPC done with {TPC_Met_Person_1} {Name_of_TPC_1} {TPC_Confirmation_1} and {TPC_Met_Person_2} {Name_of_TPC_2} {TPC_Confirmation_2} {Customer_Name} & builder office existence. They informed that given builder office at given address since last {Working_Period}.

BUILDER & PROJECT DETAILS:
Builder type is {Business_Type} and nature of business is {Company_Nature_Of_Business}. Office area approx. {Office_Approx_Area} sq. feet. Company Name board {Company_Name_Plate} {Name_On_Board}.

LOCALITY INFORMATION:
Locality is {Locality}. {Locality} is of {Address_Structure}. {Locality} color is {Address_Structure_Color} and Door color is {Door_Color}.

AREA ASSESSMENT:
It is {Dominated_Area} area. Landmarks: {Landmark_1} and {Landmark_2}. {Feedback_From_Neighbour} feedback received from neighbors. Field executive also confirmed {Customer_Name} is {Political_Connection}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    'SHIFTED': `Builder Remark: SHIFTED.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is traceable and {Address_Locatable}. Address locality is {Address_Rating}. At the time of visit builder office was {Office_Status}. Met with {Met_Person_Name} ({Designation}) confirmed that builder office shifted from the given address {Old_Office_Shifted_Period} ago.

CURRENT OFFICE STATUS:
{Current_Company_Name} builder office operating at given address from last {Current_Company_Period}. Company name board is {Company_Name_Plate} {Name_On_Board}.

LOCALITY INFORMATION:
Locality is {Locality}. {Locality} is of {Address_Structure}. {Locality} color is {Address_Structure_Color} and Door color is {Door_Color}.

THIRD PARTY CONFIRMATION:
TPC done with {TPC_Met_Person_1} {Name_of_TPC_1} and {TPC_Met_Person_2} {Name_of_TPC_2} they confirmed that builder office is shifted from the given address.

AREA ASSESSMENT:
It is {Dominated_Area} area. Landmarks: {Landmark_1} and {Landmark_2}. {Feedback_From_Neighbour} feedback received from neighbors. Field executive also confirmed {Customer_Name} is {Political_Connection}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    'SHIFTED_DOOR_LOCKED': `Builder Remark: SHIFTED & DOOR LOCKED.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is traceable and {Address_Locatable}. Address locality is {Address_Rating}. At the time of visit builder office was {Office_Status}.

THIRD PARTY CONFIRMATION:
TPC done with {TPC_Met_Person_1} {Name_of_TPC_1} and {TPC_Met_Person_2} {Name_of_TPC_2} they confirmed that builder office shifted from the given address {Old_Office_Shifted_Period} ago.

CURRENT OFFICE STATUS:
{Current_Company_Name} builder office operating at given address. Company name board is {Company_Name_Plate} {Name_On_Board}.

LOCALITY INFORMATION:
Locality is {Locality}. {Locality} is of {Address_Structure}. {Locality} color is {Address_Structure_Color} and Door color is {Door_Color}.

AREA ASSESSMENT:
It is {Dominated_Area} area. Landmarks: {Landmark_1} and {Landmark_2}. {Feedback_From_Neighbour} feedback from neighbors. Field executive also confirmed {Customer_Name} is {Political_Connection}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    'NSP': `Builder Remark: NSP (No Such Person).

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is traceable and {Address_Locatable}. Address locality is {Address_Rating}. At the time of visit builder office was {Office_Status}. Met with {Met_Person_Name} ({Designation}).

BUILDER VERIFICATION:
Met person informed that there is no such person working as builder at given address. As per current office staff, {Customer_Name} has never worked as builder at this office.

CURRENT OFFICE DETAILS:
Company name board is {Company_Name_Plate} {Name_On_Board}. Office area approx. {Office_Approx_Area} sq. feet.

LOCALITY INFORMATION:
Locality is {Locality}. {Locality} is of {Address_Structure}. {Locality} color is {Address_Structure_Color} and Door color is {Door_Color}.

THIRD PARTY CONFIRMATION:
TPC done with {TPC_Met_Person_1} {Name_of_TPC_1} and {TPC_Met_Person_2} {Name_of_TPC_2} {Third_Party_Confirmation} there is no such person working as builder at given address.

AREA ASSESSMENT:
It is {Dominated_Area} area. Landmarks: {Landmark_1} and {Landmark_2}. {Feedback_From_Neighbour} feedback received from neighbors. Applicant's builder stability is not confirmed by our executive's observation as well as from TPC.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    'NSP_DOOR_LOCKED': `Builder Remark: NSP & DOOR LOCKED.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is traceable and {Address_Locatable}. Address locality is {Address_Rating}. At the time of visit builder office was {Office_Status}.

THIRD PARTY CONFIRMATION:
TPC done with {TPC_Met_Person_1} {Name_of_TPC_1} {TPC_Confirmation_1} and {TPC_Met_Person_2} {Name_of_TPC_2} {TPC_Confirmation_2} Builder office {Office_Existence} at given address. As per TPC confirmation, there is no such person working as builder at this office.

CURRENT OFFICE STATUS:
{Current_Company_Name} builder office operating at given address. Company name board is {Company_Name_Plate} {Name_On_Board}.

LOCALITY INFORMATION:
Locality is {Locality}. {Locality} is of {Address_Structure}. {Locality} color is {Address_Structure_Color} and Door color is {Door_Color}.

AREA ASSESSMENT:
It is {Dominated_Area} area. Landmarks: {Landmark_1} and {Landmark_2}. {Feedback_From_Neighbour} feedback received from neighbors. Applicant's builder stability is not confirmed by our executive's observation as well as from TPC.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    'ERT': `Builder Entry Restricted Remark (ERT):-

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is traceable and {Address_Locatable}. Address locality is {Address_Rating}. It is {Customer_Name} builder office address. At the time of visit met with {Met_Person_Type} {Name_Of_Met_Person} informed that given premises entry not allowed.

ENTRY RESTRICTION DETAILS:
{Met_Person_Type} {Met_Person_Confirmation} builder office existence at given address. Entry is restricted due to security protocols or office policies.

LOCALITY INFORMATION:
Locality is {Locality}. {Locality} is of {Locality} and address located on {Office_Exist_Floor} floor. {Locality} color is {Address_Structure_Color}.

AREA ASSESSMENT:
It's a {Dominated_Area} area. Landmarks: {Landmark_1} and {Landmark_2}. {Feedback_From_Neighbour} feedback received from neighbors. Field executive also confirmed {Customer_Name} is {Political_Connection}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    'UNTRACEABLE': `Builder Untraceable Remark (UT):-

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is incorrect and untraceable. At the time of visit met with {Met_Person_Name}, Met person informed that provided address is short.

CONTACT ATTEMPT:
We called {Customer_Name} but {Customer_Name} {Call_Remark}. We required proper guidance to trace the address.

SEARCH EFFORTS:
Type of Locality is {Locality}. Field executive reached up to {Landmark_1}, {Landmark_2}, {Landmark_3}, {Landmark_4}. It's a {Dominated_Area} area.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`
  };

  private readonly NOC_TEMPLATES = {
    'POSITIVE': `NOC Remark: POSITIVE.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is traceable and {Address_Locatable}. Address locality is {Address_Rating}. At the time of visit NOC office was {Office_Status}. Met with {Met_Person_Name} ({Designation}), confirmed {Customer_Name} NOC verification is positive.

NOC VERIFICATION DETAILS:
NOC document verification completed successfully. All required documents are available and verified. NOC status is confirmed as valid and authentic.

LOCALITY INFORMATION:
Locality is {Locality}. {Locality} is of {Address_Structure}. {Locality} color is {Address_Structure_Color} and Door color is {Door_Color}.

THIRD PARTY CONFIRMATION:
TPC done with {TPC_Met_Person_1} {Name_of_TPC_1} {TPC_Confirmation_1} and {TPC_Met_Person_2} {Name_of_TPC_2} {TPC_Confirmation_2} NOC verification details.

AREA ASSESSMENT:
It is {Dominated_Area} area. Landmarks: {Landmark_1} and {Landmark_2}. {Feedback_From_Neighbour} feedback received from neighbors. Field executive also confirmed {Customer_Name} is {Political_Connection}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    'POSITIVE_DOOR_LOCKED': `NOC Remark: POSITIVE & DOOR LOCKED.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is traceable and {Address_Locatable}. Address locality is {Address_Rating}. At the time of visit NOC office was {Office_Status}.

THIRD PARTY CONFIRMATION:
TPC done with {TPC_Met_Person_1} {Name_of_TPC_1} {TPC_Confirmation_1} and {TPC_Met_Person_2} {Name_of_TPC_2} {TPC_Confirmation_2} NOC verification details. They confirmed NOC document verification is positive.

NOC VERIFICATION DETAILS:
NOC document verification completed through TPC. All required documents are confirmed as available and verified through third party confirmation.

LOCALITY INFORMATION:
Locality is {Locality}. {Locality} is of {Address_Structure}. {Locality} color is {Address_Structure_Color} and Door color is {Door_Color}.

AREA ASSESSMENT:
It is {Dominated_Area} area. Landmarks: {Landmark_1} and {Landmark_2}. {Feedback_From_Neighbour} feedback received from neighbors. Field executive also confirmed {Customer_Name} is {Political_Connection}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    'ERT': `NOC Entry Restricted Remark (ERT):-

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is traceable and {Address_Locatable}. Address locality is {Address_Rating}. It is {Customer_Name} NOC verification address. At the time of visit met with {Met_Person_Type} {Name_Of_Met_Person} informed that given premises entry not allowed.

ENTRY RESTRICTION DETAILS:
{Met_Person_Type} {Met_Person_Confirmation} NOC office existence at given address. Entry is restricted due to security protocols or office policies.

LOCALITY INFORMATION:
Locality is {Locality}. {Locality} is of {Locality} and address located on {Office_Exist_Floor} floor. {Locality} color is {Address_Structure_Color}.

AREA ASSESSMENT:
It's a {Dominated_Area} area. Landmarks: {Landmark_1} and {Landmark_2}. {Feedback_From_Neighbour} feedback received from neighbors. Field executive also confirmed {Customer_Name} is {Political_Connection}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    'UNTRACEABLE': `NOC Untraceable Remark (UT):-

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is incorrect and untraceable. At the time of visit met with {Met_Person_Name}, Met person informed that provided address is short.

CONTACT ATTEMPT:
We called {Customer_Name} but {Customer_Name} {Call_Remark}. We required proper guidance to trace the address.

SEARCH EFFORTS:
Type of Locality is {Locality}. Field executive reached up to {Landmark_1}, {Landmark_2}, {Landmark_3}, {Landmark_4}. It's a {Dominated_Area} area.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`
  };

  private readonly DSA_CONNECTOR_TEMPLATES = {
    'POSITIVE': `DSA/Connector Remark: POSITIVE.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is traceable and {Address_Locatable}. Address locality is {Address_Rating}. At the time of visit DSA/Connector office was {Office_Status}. Met with {Met_Person_Name} ({Designation}), confirmed {Customer_Name} is working as DSA/Connector at given address since last {Working_Period}.

DSA/CONNECTOR DETAILS:
DSA/Connector type is {Business_Type} and nature of business is {Company_Nature_Of_Business}. Office area approx. {Office_Approx_Area} sq. feet. Working period is {Working_Period}. Company Name board {Company_Name_Plate} {Name_On_Board}.

LOCALITY INFORMATION:
Locality is {Locality}. {Locality} is of {Address_Structure}. {Locality} color is {Address_Structure_Color} and Door color is {Door_Color}.

THIRD PARTY CONFIRMATION:
TPC done with {TPC_Met_Person_1} {Name_of_TPC_1} {TPC_Confirmation_1} and {TPC_Met_Person_2} {Name_of_TPC_2} {TPC_Confirmation_2} {Customer_Name} & DSA/Connector office existence.

AREA ASSESSMENT:
It is {Dominated_Area} area. Landmarks: {Landmark_1} and {Landmark_2}. {Feedback_From_Neighbour} feedback received from neighbors. Field executive also confirmed {Customer_Name} is {Political_Connection}. {Customer_Name} DSA/Connector stability is confirmed by our executive's observation as well as from TPC.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    'POSITIVE_DOOR_LOCKED': `DSA/Connector Remark: POSITIVE & DOOR LOCKED.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is traceable and {Address_Locatable}. Address locality is {Address_Rating}. At the time of visit DSA/Connector office was {Office_Status}.

THIRD PARTY CONFIRMATION:
TPC done with {TPC_Met_Person_1} {Name_of_TPC_1} {TPC_Confirmation_1} and {TPC_Met_Person_2} {Name_of_TPC_2} {TPC_Confirmation_2} {Customer_Name} & DSA/Connector office existence. They informed that given DSA/Connector office at given address since last {Working_Period}.

DSA/CONNECTOR DETAILS:
DSA/Connector type is {Business_Type} and nature of business is {Company_Nature_Of_Business}. Office area approx. {Office_Approx_Area} sq. feet. Company Name board {Company_Name_Plate} {Name_On_Board}.

LOCALITY INFORMATION:
Locality is {Locality}. {Locality} is of {Address_Structure}. {Locality} color is {Address_Structure_Color} and Door color is {Door_Color}.

AREA ASSESSMENT:
It is {Dominated_Area} area. Landmarks: {Landmark_1} and {Landmark_2}. {Feedback_From_Neighbour} feedback received from neighbors. Field executive also confirmed {Customer_Name} is {Political_Connection}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    'SHIFTED': `DSA/Connector Remark: SHIFTED.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is traceable and {Address_Locatable}. Address locality is {Address_Rating}. At the time of visit DSA/Connector office was {Office_Status}. Met with {Met_Person_Name} ({Designation}) confirmed that DSA/Connector office shifted from the given address {Old_Office_Shifted_Period} ago.

CURRENT OFFICE STATUS:
{Current_Company_Name} DSA/Connector office operating at given address from last {Current_Company_Period}. Company name board is {Company_Name_Plate} {Name_On_Board}.

LOCALITY INFORMATION:
Locality is {Locality}. {Locality} is of {Address_Structure}. {Locality} color is {Address_Structure_Color} and Door color is {Door_Color}.

THIRD PARTY CONFIRMATION:
TPC done with {TPC_Met_Person_1} {Name_of_TPC_1} and {TPC_Met_Person_2} {Name_of_TPC_2} they confirmed that DSA/Connector office is shifted from the given address.

AREA ASSESSMENT:
It is {Dominated_Area} area. Landmarks: {Landmark_1} and {Landmark_2}. {Feedback_From_Neighbour} feedback received from neighbors. Field executive also confirmed {Customer_Name} is {Political_Connection}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    'SHIFTED_DOOR_LOCKED': `DSA/Connector Remark: SHIFTED & DOOR LOCKED.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is traceable and {Address_Locatable}. Address locality is {Address_Rating}. At the time of visit DSA/Connector office was {Office_Status}.

THIRD PARTY CONFIRMATION:
TPC done with {TPC_Met_Person_1} {Name_of_TPC_1} and {TPC_Met_Person_2} {Name_of_TPC_2} they confirmed that DSA/Connector office shifted from the given address {Old_Office_Shifted_Period} ago.

CURRENT OFFICE STATUS:
{Current_Company_Name} DSA/Connector office operating at given address. Company name board is {Company_Name_Plate} {Name_On_Board}.

LOCALITY INFORMATION:
Locality is {Locality}. {Locality} is of {Address_Structure}. {Locality} color is {Address_Structure_Color} and Door color is {Door_Color}.

AREA ASSESSMENT:
It is {Dominated_Area} area. Landmarks: {Landmark_1} and {Landmark_2}. {Feedback_From_Neighbour} feedback from neighbors. Field executive also confirmed {Customer_Name} is {Political_Connection}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    'NSP': `DSA/Connector Remark: NSP (No Such Person).

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is traceable and {Address_Locatable}. Address locality is {Address_Rating}. At the time of visit DSA/Connector office was {Office_Status}. Met with {Met_Person_Name} ({Designation}).

DSA/CONNECTOR VERIFICATION:
Met person informed that there is no such person working as DSA/Connector at given address. As per current office staff, {Customer_Name} has never worked as DSA/Connector at this office.

CURRENT OFFICE DETAILS:
Company name board is {Company_Name_Plate} {Name_On_Board}. Office area approx. {Office_Approx_Area} sq. feet.

LOCALITY INFORMATION:
Locality is {Locality}. {Locality} is of {Address_Structure}. {Locality} color is {Address_Structure_Color} and Door color is {Door_Color}.

THIRD PARTY CONFIRMATION:
TPC done with {TPC_Met_Person_1} {Name_of_TPC_1} and {TPC_Met_Person_2} {Name_of_TPC_2} {Third_Party_Confirmation} there is no such person working as DSA/Connector at given address.

AREA ASSESSMENT:
It is {Dominated_Area} area. Landmarks: {Landmark_1} and {Landmark_2}. {Feedback_From_Neighbour} feedback received from neighbors. Applicant's DSA/Connector stability is not confirmed by our executive's observation as well as from TPC.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    'NSP_DOOR_LOCKED': `DSA/Connector Remark: NSP & DOOR LOCKED.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is traceable and {Address_Locatable}. Address locality is {Address_Rating}. At the time of visit DSA/Connector office was {Office_Status}.

THIRD PARTY CONFIRMATION:
TPC done with {TPC_Met_Person_1} {Name_of_TPC_1} {TPC_Confirmation_1} and {TPC_Met_Person_2} {Name_of_TPC_2} {TPC_Confirmation_2} DSA/Connector office {Office_Existence} at given address. As per TPC confirmation, there is no such person working as DSA/Connector at this office.

CURRENT OFFICE STATUS:
{Current_Company_Name} DSA/Connector office operating at given address. Company name board is {Company_Name_Plate} {Name_On_Board}.

LOCALITY INFORMATION:
Locality is {Locality}. {Locality} is of {Address_Structure}. {Locality} color is {Address_Structure_Color} and Door color is {Door_Color}.

AREA ASSESSMENT:
It is {Dominated_Area} area. Landmarks: {Landmark_1} and {Landmark_2}. {Feedback_From_Neighbour} feedback received from neighbors. Applicant's DSA/Connector stability is not confirmed by our executive's observation as well as from TPC.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    'ERT': `DSA/Connector Entry Restricted Remark (ERT):-

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is traceable and {Address_Locatable}. Address locality is {Address_Rating}. It is {Customer_Name} DSA/Connector office address. At the time of visit met with {Met_Person_Type} {Name_Of_Met_Person} informed that given premises entry not allowed.

ENTRY RESTRICTION DETAILS:
{Met_Person_Type} {Met_Person_Confirmation} DSA/Connector office existence at given address. Entry is restricted due to security protocols or office policies.

LOCALITY INFORMATION:
Locality is {Locality}. {Locality} is of {Locality} and address located on {Office_Exist_Floor} floor. {Locality} color is {Address_Structure_Color}.

AREA ASSESSMENT:
It's a {Dominated_Area} area. Landmarks: {Landmark_1} and {Landmark_2}. {Feedback_From_Neighbour} feedback received from neighbors. Field executive also confirmed {Customer_Name} is {Political_Connection}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    'UNTRACEABLE': `DSA/Connector Untraceable Remark (UT):-

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is incorrect and untraceable. At the time of visit met with {Met_Person_Name}, Met person informed that provided address is short.

CONTACT ATTEMPT:
We called {Customer_Name} but {Customer_Name} {Call_Remark}. We required proper guidance to trace the address.

SEARCH EFFORTS:
Type of Locality is {Locality}. Field executive reached up to {Landmark_1}, {Landmark_2}, {Landmark_3}, {Landmark_4}. It's a {Dominated_Area} area.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`
  };

  private readonly PROPERTY_APF_TEMPLATES = {
    'POSITIVE_NEGATIVE': `Property APF Remark: POSITIVE/NEGATIVE.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is traceable and {Address_Locatable}. Address locality is {Address_Rating}. At the time of visit property was accessible for verification.

PROPERTY VERIFICATION:
Property verification completed for APF (Approved Project Financing) assessment. Property details verified against project documentation. Property status confirmed as per APF requirements.

PROPERTY DETAILS:
Property type is {Business_Type} and project nature is {Company_Nature_Of_Business}. Property area approx. {Business_Approx_Area} sq. feet. Project establishment period is {Establishment_Period}. Developer/Builder name is {Business_Owner_Name}.

LOCALITY INFORMATION:
Locality is {Locality}. {Locality} is of {Address_Structure}. {Locality} color is {Address_Structure_Color} and access point color is {Door_Color}.

THIRD PARTY CONFIRMATION:
TPC done with {TPC_Met_Person_1} {Name_of_TPC_1} {TPC_Confirmation_1} and {TPC_Met_Person_2} {Name_of_TPC_2} {TPC_Confirmation_2} property existence and APF compliance.

AREA ASSESSMENT:
It is {Dominated_Area} area. Landmarks: {Landmark_1} and {Landmark_2}. {Feedback_From_Neighbour} feedback received from neighbors regarding the property. Field executive also confirmed property is {Political_Connection}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    'ERT': `Property APF Entry Restricted Remark (ERT):-

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is traceable and {Address_Locatable}. Address locality is {Address_Rating}. It is {Customer_Name} property address for APF verification. At the time of visit met with {Met_Person_Type} {Name_Of_Met_Person} informed that given premises entry not allowed.

ENTRY RESTRICTION DETAILS:
{Met_Person_Type} {Met_Person_Confirmation} property existence at given address. Entry is restricted due to security protocols or property access policies.

LOCALITY INFORMATION:
Locality is {Locality}. {Locality} is of {Locality} and property located on {Office_Exist_Floor} floor. {Locality} color is {Address_Structure_Color}.

AREA ASSESSMENT:
It's a {Dominated_Area} area. Landmarks: {Landmark_1} and {Landmark_2}. {Feedback_From_Neighbour} feedback received from neighbors. Field executive also confirmed property is {Political_Connection}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    'UNTRACEABLE': `Property APF Untraceable Remark (UT):-

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is incorrect and untraceable. At the time of visit met with {Met_Person_Name}, Met person informed that provided address is short.

CONTACT ATTEMPT:
We called {Customer_Name} but {Customer_Name} {Call_Remark}. We required proper guidance to trace the property address.

SEARCH EFFORTS:
Type of Locality is {Locality}. Field executive reached up to {Landmark_1}, {Landmark_2}, {Landmark_3}, {Landmark_4}. It's a {Dominated_Area} area.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`
  };

  private readonly PROPERTY_INDIVIDUAL_TEMPLATES = {
    'POSITIVE': `Property Individual Remark: POSITIVE.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is traceable and {Address_Locatable}. Address locality is {Address_Rating}. At the time of visit property was {Business_Status}. Met with {Met_Person_Name} ({Designation}), confirmed {Customer_Name} property ownership at given address since last {Business_Period}.

PROPERTY OWNERSHIP DETAILS:
Property type is {Business_Type} and nature of property is {Company_Nature_Of_Business}. Property area approx. {Business_Approx_Area} sq. feet. Property ownership period is {Establishment_Period}. Property owner name is {Business_Owner_Name}. Property name board {Company_Name_Plate} {Name_On_Board}.

PROPERTY STATUS:
Property activity includes {Business_Activity}. Property setup is {Business_Setup}. Property existence confirmed as {Business_Existence}. Current property status is verified and confirmed.

LOCALITY INFORMATION:
Locality is {Locality}. {Locality} is of {Address_Structure}. {Locality} color is {Address_Structure_Color} and Door color is {Door_Color}.

THIRD PARTY CONFIRMATION:
TPC done with {TPC_Met_Person_1} {Name_of_TPC_1} {TPC_Confirmation_1} and {TPC_Met_Person_2} {Name_of_TPC_2} {TPC_Confirmation_2} {Customer_Name} & property ownership.

AREA ASSESSMENT:
It is {Dominated_Area} area. Landmarks: {Landmark_1} and {Landmark_2}. {Feedback_From_Neighbour} feedback found regarding {Customer_Name} & property. Field executive also confirmed {Customer_Name} is {Political_Connection}. {Customer_Name} property ownership is confirmed by our executive's observation as well as from TPC.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    'POSITIVE_DOOR_LOCKED': `Property Individual Remark: POSITIVE & DOOR LOCKED.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is traceable and {Address_Locatable}. Address locality is {Address_Rating}. At the time of visit property was {Business_Status}.

THIRD PARTY CONFIRMATION:
TPC done with {TPC_Met_Person_1} {Name_of_TPC_1} {TPC_Confirmation_1} and {TPC_Met_Person_2} {Name_of_TPC_2} {TPC_Confirmation_2} {Customer_Name} & property ownership. They informed that given property owned by {Customer_Name} at given address since last {Business_Period}.

PROPERTY OWNERSHIP DETAILS:
Property type is {Business_Type} and nature of property is {Company_Nature_Of_Business}. Property area approx. {Business_Approx_Area} sq. feet. Property ownership period is {Establishment_Period}. Property name board {Company_Name_Plate} {Name_On_Board}.

LOCALITY INFORMATION:
Locality is {Locality}. {Locality} is of {Address_Structure}. {Locality} color is {Address_Structure_Color} and Door color is {Door_Color}.

AREA ASSESSMENT:
It is {Dominated_Area} area. Landmarks: {Landmark_1} and {Landmark_2}. {Feedback_From_Neighbour} feedback received from neighbors. Field executive also confirmed {Customer_Name} is {Political_Connection}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    'SHIFTED': `Property Individual Remark: SHIFTED.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is traceable and {Address_Locatable}. Address locality is {Address_Rating}. At the time of visit property was {Business_Status}. Met with {Met_Person_Name} ({Designation}) confirmed that property ownership shifted from {Customer_Name} {Old_Business_Shifted_Period} ago.

CURRENT PROPERTY STATUS:
{Current_Company_Name} is current property owner at given address from last {Current_Company_Period}. Property name board is {Company_Name_Plate} {Name_On_Board}.

LOCALITY INFORMATION:
Locality is {Locality}. {Locality} is of {Address_Structure}. {Locality} color is {Address_Structure_Color} and Door color is {Door_Color}.

THIRD PARTY CONFIRMATION:
TPC done with {TPC_Met_Person_1} {Name_of_TPC_1} and {TPC_Met_Person_2} {Name_of_TPC_2} they confirmed that property ownership is shifted from {Customer_Name}.

AREA ASSESSMENT:
It is {Dominated_Area} area. Landmarks: {Landmark_1} and {Landmark_2}. {Feedback_From_Neighbour} feedback received from neighbors. Field executive also confirmed {Customer_Name} is {Political_Connection}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    'SHIFTED_DOOR_LOCKED': `Property Individual Remark: SHIFTED & DOOR LOCKED.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is traceable and {Address_Locatable}. Address locality is {Address_Rating}. At the time of visit property was {Business_Status}.

THIRD PARTY CONFIRMATION:
TPC done with {TPC_Met_Person_1} {Name_of_TPC_1} and {TPC_Met_Person_2} {Name_of_TPC_2} they confirmed that property ownership shifted from {Customer_Name} {Old_Business_Shifted_Period} ago.

CURRENT PROPERTY STATUS:
{Current_Company_Name} is current property owner at given address. Property name board is {Company_Name_Plate} {Name_On_Board}.

LOCALITY INFORMATION:
Locality is {Locality}. {Locality} is of {Address_Structure}. {Locality} color is {Address_Structure_Color} and Door color is {Door_Color}.

AREA ASSESSMENT:
It is {Dominated_Area} area. Landmarks: {Landmark_1} and {Landmark_2}. {Feedback_From_Neighbour} feedback from neighbors. Field executive also confirmed {Customer_Name} is {Political_Connection}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    'NSP': `Property Individual Remark: NSP (No Such Person).

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is traceable and {Address_Locatable}. Address locality is {Address_Rating}. At the time of visit property was {Business_Status}. Met with {Met_Person_Name} ({Designation}).

PROPERTY VERIFICATION:
Met person informed that there is no such person owning property at given address. As per current property owner, {Customer_Name} has never owned property at this address.

CURRENT PROPERTY DETAILS:
Property name board is {Company_Name_Plate} {Name_On_Board}. Property area approx. {Business_Approx_Area} sq. feet.

LOCALITY INFORMATION:
Locality is {Locality}. {Locality} is of {Address_Structure}. {Locality} color is {Address_Structure_Color} and Door color is {Door_Color}.

THIRD PARTY CONFIRMATION:
TPC done with {TPC_Met_Person_1} {Name_of_TPC_1} and {TPC_Met_Person_2} {Name_of_TPC_2} {Third_Party_Confirmation} there is no such person owning property at given address.

AREA ASSESSMENT:
It is {Dominated_Area} area. Landmarks: {Landmark_1} and {Landmark_2}. {Feedback_From_Neighbour} feedback received from neighbors. Applicant's property ownership is not confirmed by our executive's observation as well as from TPC.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    'NSP_DOOR_LOCKED': `Property Individual Remark: NSP & DOOR LOCKED.

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is traceable and {Address_Locatable}. Address locality is {Address_Rating}. At the time of visit property was {Business_Status}.

THIRD PARTY CONFIRMATION:
TPC done with {TPC_Met_Person_1} {Name_of_TPC_1} {TPC_Confirmation_1} and {TPC_Met_Person_2} {Name_of_TPC_2} {TPC_Confirmation_2} Property {Business_Existence} at given address. As per TPC confirmation, there is no such person owning property at this address.

CURRENT PROPERTY STATUS:
{Current_Company_Name} is current property owner at given address. Property name board is {Company_Name_Plate} {Name_On_Board}.

LOCALITY INFORMATION:
Locality is {Locality}. {Locality} is of {Address_Structure}. {Locality} color is {Address_Structure_Color} and Door color is {Door_Color}.

AREA ASSESSMENT:
It is {Dominated_Area} area. Landmarks: {Landmark_1} and {Landmark_2}. {Feedback_From_Neighbour} feedback received from neighbors. Applicant's property ownership is not confirmed by our executive's observation as well as from TPC.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    'ERT': `Property Individual Entry Restricted Remark (ERT):-

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is traceable and {Address_Locatable}. Address locality is {Address_Rating}. It is {Customer_Name} property address. At the time of visit met with {Met_Person_Type} {Name_Of_Met_Person} informed that given premises entry not allowed.

ENTRY RESTRICTION DETAILS:
{Met_Person_Type} {Met_Person_Confirmation} property existence at given address. Entry is restricted due to security protocols or property access policies.

LOCALITY INFORMATION:
Locality is {Locality}. {Locality} is of {Locality} and property located on {Office_Exist_Floor} floor. {Locality} color is {Address_Structure_Color}.

AREA ASSESSMENT:
It's a {Dominated_Area} area. Landmarks: {Landmark_1} and {Landmark_2}. {Feedback_From_Neighbour} feedback received from neighbors. Field executive also confirmed {Customer_Name} is {Political_Connection}.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    'UNTRACEABLE': `Property Individual Untraceable Remark (UT):-

VERIFICATION DETAILS:
Visited at the given address for {Customer_Name} ({Applicant_Type}). The given address is incorrect and untraceable. At the time of visit met with {Met_Person_Name}, Met person informed that provided address is short.

CONTACT ATTEMPT:
We called {Customer_Name} but {Customer_Name} {Call_Remark}. We required proper guidance to trace the property address.

SEARCH EFFORTS:
Type of Locality is {Locality}. Field executive reached up to {Landmark_1}, {Landmark_2}, {Landmark_3}, {Landmark_4}. It's a {Dominated_Area} area.

CONCLUSION:
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`
  };

  /**
   * Generate template-based report for verification form submission
   */
  async generateTemplateReport(data: VerificationReportData): Promise<TemplateReportResult> {
    try {
      logger.info('Generating template-based report', {
        verificationType: data.verificationType,
        outcome: data.outcome,
        caseId: data.caseDetails.caseId
      });

      // Get appropriate template
      const template = this.getTemplate(data.verificationType, data.outcome, data.formData);
      if (!template) {
        throw new Error(`No template found for ${data.verificationType} - ${data.outcome}`);
      }

      // Map form data to template variables
      const templateVariables = this.mapFormDataToTemplateVariables(data.formData, data.caseDetails);
      
      // Replace template variables with actual data
      let populatedTemplate = template;
      Object.entries(templateVariables).forEach(([key, value]) => {
        const placeholder = `{${key}}`;
        populatedTemplate = populatedTemplate.replace(new RegExp(placeholder, 'g'), value);
      });

      logger.info('Template-based report generated successfully', {
        caseId: data.caseDetails.caseId,
        templateUsed: this.getTemplateKey(data.verificationType, data.outcome, data.formData)
      });

      return {
        success: true,
        report: populatedTemplate,
        metadata: {
          verificationType: data.verificationType,
          outcome: data.outcome,
          generatedAt: new Date().toISOString(),
          templateUsed: this.getTemplateKey(data.verificationType, data.outcome, data.formData)
        }
      };

    } catch (error) {
      logger.error('Error generating template-based report:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Get template for specific verification type and outcome
   */
  private getTemplate(verificationType: string, outcome: string, formData?: any): string | null {
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
  private getTemplateKey(verificationType: string, outcome: string, formData?: any): string {
    const outcomeNormalized = outcome.toLowerCase();

    if (verificationType.toUpperCase() === 'RESIDENCE') {
      // Handle Shifted scenarios
      if (outcomeNormalized.includes('shifted')) {
        if (outcomeNormalized.includes('door lock') || outcomeNormalized.includes('door locked') || outcomeNormalized.includes('locked')) {
          return 'SHIFTED_DOOR_LOCKED';
        } else {
          return 'SHIFTED';
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
        if (outcomeNormalized.includes('door lock') || outcomeNormalized.includes('door locked') || outcomeNormalized.includes('locked')) {
          return 'NSP_DOOR_LOCKED';
        } else {
          return 'NSP';
        }
      }

      // Handle Positive scenarios - use house status to determine template
      if (outcomeNormalized.includes('positive')) {
        const houseStatus = formData?.houseStatus || formData?.house_status;
        if (houseStatus && houseStatus.toLowerCase() === 'opened') {
          return 'POSITIVE'; // Door was open, person was met
        } else {
          return 'POSITIVE_DOOR_LOCKED'; // Door was closed/locked
        }
      }
    }

    if (verificationType.toUpperCase() === 'OFFICE') {
      // Handle Shifted scenarios - use office status to determine template
      if (outcomeNormalized.includes('shifted')) {
        const officeStatus = formData?.officeStatus || formData?.office_status;
        if (officeStatus && officeStatus.toLowerCase() === 'opened') {
          return 'SHIFTED'; // Office was open, person was met
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
        const officeStatus = formData?.officeStatus || formData?.office_status;
        if (officeStatus && officeStatus.toLowerCase() === 'opened') {
          return 'NSP'; // Office was open, person was met
        } else {
          return 'NSP_DOOR_LOCKED'; // Office was closed, only TPC
        }
      }

      // Handle Positive scenarios - use office status to determine template
      if (outcomeNormalized.includes('positive')) {
        // Check office status to determine if person was met or only TPC was done
        const officeStatus = formData?.officeStatus || formData?.office_status;
        if (officeStatus && officeStatus.toLowerCase() === 'opened') {
          return 'POSITIVE'; // Office was open, person was met
        } else {
          return 'POSITIVE_DOOR_LOCKED'; // Office was closed, only TPC
        }
      }
    }

    if (verificationType.toUpperCase() === 'BUSINESS') {
      // Handle Shifted scenarios - use business status to determine template
      if (outcomeNormalized.includes('shifted')) {
        const businessStatus = formData?.businessStatus || formData?.business_status;
        if (businessStatus && businessStatus.toLowerCase() === 'opened') {
          return 'SHIFTED'; // Business was open, person was met
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
        const businessStatus = formData?.businessStatus || formData?.business_status;
        if (businessStatus && businessStatus.toLowerCase() === 'opened') {
          return 'NSP'; // Business was open, person was met
        } else {
          return 'NSP_DOOR_LOCKED'; // Business was closed, only TPC
        }
      }

      // Handle Positive scenarios - use business status to determine template
      if (outcomeNormalized.includes('positive')) {
        const businessStatus = formData?.businessStatus || formData?.business_status;
        if (businessStatus && businessStatus.toLowerCase() === 'opened') {
          return 'POSITIVE'; // Business was open, person was met
        } else {
          return 'POSITIVE_DOOR_LOCKED'; // Business was closed, only TPC
        }
      }
    }

    if (verificationType.toUpperCase() === 'RESIDENCE_CUM_OFFICE') {
      // Handle Shifted scenarios - use house/office status to determine template
      if (outcomeNormalized.includes('shifted')) {
        const houseStatus = formData?.houseStatus || formData?.house_status;
        const officeStatus = formData?.officeStatus || formData?.office_status;
        if ((houseStatus && houseStatus.toLowerCase() === 'opened') ||
            (officeStatus && officeStatus.toLowerCase() === 'opened')) {
          return 'SHIFTED'; // Either residence or office was accessible
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
        const houseStatus = formData?.houseStatus || formData?.house_status;
        const officeStatus = formData?.officeStatus || formData?.office_status;
        if ((houseStatus && houseStatus.toLowerCase() === 'opened') ||
            (officeStatus && officeStatus.toLowerCase() === 'opened')) {
          return 'NSP'; // Either residence or office was accessible
        } else {
          return 'NSP_DOOR_LOCKED'; // Both were closed, only TPC
        }
      }

      // Handle Positive scenarios - use house/office status to determine template
      if (outcomeNormalized.includes('positive')) {
        const houseStatus = formData?.houseStatus || formData?.house_status;
        const officeStatus = formData?.officeStatus || formData?.office_status;
        if ((houseStatus && houseStatus.toLowerCase() === 'opened') ||
            (officeStatus && officeStatus.toLowerCase() === 'opened')) {
          return 'POSITIVE'; // Either residence or office was accessible
        } else {
          return 'POSITIVE_DOOR_LOCKED'; // Both were closed, only TPC
        }
      }
    }

    if (verificationType.toUpperCase() === 'BUILDER') {
      // Handle Shifted scenarios - use office status to determine template
      if (outcomeNormalized.includes('shifted')) {
        const officeStatus = formData?.officeStatus || formData?.office_status;
        if (officeStatus && officeStatus.toLowerCase() === 'opened') {
          return 'SHIFTED'; // Builder office was open, person was met
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
        const officeStatus = formData?.officeStatus || formData?.office_status;
        if (officeStatus && officeStatus.toLowerCase() === 'opened') {
          return 'NSP'; // Builder office was open, person was met
        } else {
          return 'NSP_DOOR_LOCKED'; // Builder office was closed, only TPC
        }
      }

      // Handle Positive scenarios - use office status to determine template
      if (outcomeNormalized.includes('positive')) {
        const officeStatus = formData?.officeStatus || formData?.office_status;
        if (officeStatus && officeStatus.toLowerCase() === 'opened') {
          return 'POSITIVE'; // Builder office was open, person was met
        } else {
          return 'POSITIVE_DOOR_LOCKED'; // Builder office was closed, only TPC
        }
      }
    }

    if (verificationType.toUpperCase() === 'NOC') {
      // NOC has simplified logic - only POSITIVE, ERT, and UNTRACEABLE
      if (outcomeNormalized.includes('ert') || outcomeNormalized === 'ert') {
        return 'ERT';
      }

      if (outcomeNormalized.includes('untraceable') || outcomeNormalized === 'untraceable') {
        return 'UNTRACEABLE';
      }

      // Handle Positive scenarios - use office status to determine template
      if (outcomeNormalized.includes('positive')) {
        const officeStatus = formData?.officeStatus || formData?.office_status;
        if (officeStatus && officeStatus.toLowerCase() === 'opened') {
          return 'POSITIVE'; // NOC office was open, person was met
        } else {
          return 'POSITIVE_DOOR_LOCKED'; // NOC office was closed, only TPC
        }
      }
    }

    if (verificationType.toUpperCase() === 'DSA_CONNECTOR') {
      // Handle Shifted scenarios - use office status to determine template
      if (outcomeNormalized.includes('shifted')) {
        const officeStatus = formData?.officeStatus || formData?.office_status;
        if (officeStatus && officeStatus.toLowerCase() === 'opened') {
          return 'SHIFTED'; // DSA/Connector office was open, person was met
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
        const officeStatus = formData?.officeStatus || formData?.office_status;
        if (officeStatus && officeStatus.toLowerCase() === 'opened') {
          return 'NSP'; // DSA/Connector office was open, person was met
        } else {
          return 'NSP_DOOR_LOCKED'; // DSA/Connector office was closed, only TPC
        }
      }

      // Handle Positive scenarios - use office status to determine template
      if (outcomeNormalized.includes('positive')) {
        const officeStatus = formData?.officeStatus || formData?.office_status;
        if (officeStatus && officeStatus.toLowerCase() === 'opened') {
          return 'POSITIVE'; // DSA/Connector office was open, person was met
        } else {
          return 'POSITIVE_DOOR_LOCKED'; // DSA/Connector office was closed, only TPC
        }
      }
    }

    if (verificationType.toUpperCase() === 'PROPERTY_APF') {
      // PROPERTY_APF has simplified logic - only POSITIVE_NEGATIVE, ERT, and UNTRACEABLE
      if (outcomeNormalized.includes('ert') || outcomeNormalized === 'ert') {
        return 'ERT';
      }

      if (outcomeNormalized.includes('untraceable') || outcomeNormalized === 'untraceable') {
        return 'UNTRACEABLE';
      }

      // Handle Positive/Negative scenarios - PROPERTY_APF uses combined template
      if (outcomeNormalized.includes('positive') || outcomeNormalized.includes('negative')) {
        return 'POSITIVE_NEGATIVE';
      }
    }

    if (verificationType.toUpperCase() === 'PROPERTY_INDIVIDUAL') {
      // Handle Shifted scenarios - use property status to determine template
      if (outcomeNormalized.includes('shifted')) {
        const propertyStatus = formData?.businessStatus || formData?.business_status || formData?.propertyStatus;
        if (propertyStatus && propertyStatus.toLowerCase() === 'opened') {
          return 'SHIFTED'; // Property was accessible, person was met
        } else {
          return 'SHIFTED_DOOR_LOCKED'; // Property was closed, only TPC
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

      // Handle NSP scenarios - use property status to determine template
      if (outcomeNormalized.includes('nsp')) {
        const propertyStatus = formData?.businessStatus || formData?.business_status || formData?.propertyStatus;
        if (propertyStatus && propertyStatus.toLowerCase() === 'opened') {
          return 'NSP'; // Property was accessible, person was met
        } else {
          return 'NSP_DOOR_LOCKED'; // Property was closed, only TPC
        }
      }

      // Handle Positive scenarios - use property status to determine template
      if (outcomeNormalized.includes('positive')) {
        const propertyStatus = formData?.businessStatus || formData?.business_status || formData?.propertyStatus;
        if (propertyStatus && propertyStatus.toLowerCase() === 'opened') {
          return 'POSITIVE'; // Property was accessible, person was met
        } else {
          return 'POSITIVE_DOOR_LOCKED'; // Property was closed, only TPC
        }
      }
    }

    return 'DEFAULT';
  }

  /**
   * Get proper customer name, fallback to met person name if customer name is invalid
   */
  private getCustomerName(formData: any, caseDetails: any): string {
    const customerName = caseDetails.customerName;
    const metPersonName = formData?.metPersonName || formData?.met_person_name;

    // Check if customer name looks like test data or is invalid
    if (!customerName ||
        customerName.toLowerCase().includes('test') ||
        customerName.toLowerCase().includes('residance') ||
        customerName.toLowerCase().includes('door') ||
        customerName.toLowerCase().includes('positive') ||
        customerName.toLowerCase().includes('report')) {
      return metPersonName || 'Customer';
    }

    return customerName;
  }

  /**
   * Format area in square feet with proper units
   */
  private formatAreaSqFeet(formData: any, type: string = 'residence'): string {
    let area: any;

    if (type === 'office') {
      area = formData?.officeApproxArea || formData?.office_approx_area || formData?.officeArea;
    } else if (type === 'business') {
      area = formData?.businessApproxArea || formData?.business_approx_area || formData?.businessArea;
    } else {
      area = formData?.approxArea || formData?.approx_area || formData?.approximateArea || formData?.approxAreaSqFeet;
    }

    if (area && !isNaN(area) && area > 0) {
      return `${area} sq. feet`;
    }

    return 'Not provided';
  }

  /**
   * Map form data to template variables for verification reports
   */
  private mapFormDataToTemplateVariables(formData: any, caseDetails: any): Record<string, string> {
    const safeGet = (obj: any, key: string, defaultValue: string = 'Not provided') => {
      return obj?.[key] || obj?.[key.toLowerCase()] || obj?.[key.replace(/([A-Z])/g, '_$1').toLowerCase()] || defaultValue;
    };

    return {
      // Address and basic info
      ADDRESS: caseDetails.address || 'Address not provided',
      Address_Locatable: safeGet(formData, 'addressLocatable'),
      Address_Rating: safeGet(formData, 'addressRating'),

      // Person details
      Met_Person_Name: safeGet(formData, 'metPersonName') || safeGet(formData, 'personMet') || safeGet(formData, 'met_person_name'),
      Customer_Name: this.getCustomerName(formData, caseDetails),
      Applicant_Type: caseDetails.applicantType || 'APPLICANT',
      Applicant_Status: caseDetails.customerName || safeGet(formData, 'customerName') || safeGet(formData, 'applicantStatus') || 'Applicant',
      Met_Person_Relation: safeGet(formData, 'metPersonRelation') || safeGet(formData, 'relation'),

      // Staying details
      Staying_Period: safeGet(formData, 'stayingPeriod') || safeGet(formData, 'stayingSince'),
      Staying_Status: safeGet(formData, 'stayingStatus'),

      // Property details
      Approx_Area_Sq_Feet: this.formatAreaSqFeet(formData),
      Total_Family_Members: safeGet(formData, 'totalFamilyMembers') || safeGet(formData, 'familyMembers'),
      Total_Earning: safeGet(formData, 'totalEarning') || safeGet(formData, 'earningMembers'),
      
      // Work details
      Working_Status: safeGet(formData, 'workingStatus'),
      Company_Name: safeGet(formData, 'companyName') || safeGet(formData, 'employerName'),
      
      // Name plates and boards
      Door_Name_Plate: safeGet(formData, 'doorNamePlateStatus') === 'Sighted' ? 'Available' : 'Not Available',
      Name_on_Door_Plate: safeGet(formData, 'nameOnDoorPlate') || safeGet(formData, 'doorNamePlate'),
      Society_Name_Plate: safeGet(formData, 'societyNamePlateStatus') === 'Sighted' ? 'Available' : 'Not Available',
      Name_on_Society_Board: safeGet(formData, 'nameOnSocietyBoard') || safeGet(formData, 'societyNamePlate'),
      
      // Locality details
      Locality: safeGet(formData, 'localityType') || safeGet(formData, 'locality') || 'Tower / Building',
      Address_Structure_G_Plus: safeGet(formData, 'addressStructure') || safeGet(formData, 'addressStructureGPlus'),
      Applicant_Staying_Floor: safeGet(formData, 'addressFloor') || safeGet(formData, 'applicantStayingFloor') || safeGet(formData, 'floor'),
      Address_Structure_Color: safeGet(formData, 'addressStructureColor') || safeGet(formData, 'buildingColor'),
      Door_Color: safeGet(formData, 'doorColor'),
      
      // Documents
      Document_Type: safeGet(formData, 'documentType'),
      
      // TPC details
      TPC_Met_Person_1: safeGet(formData, 'tpcMetPerson1') || safeGet(formData, 'tpcMetPerson'),
      Name_of_TPC_1: safeGet(formData, 'nameOfTpc1') || safeGet(formData, 'tpcName1'),
      TPC_Confirmation_1: safeGet(formData, 'tpcConfirmation1') || safeGet(formData, 'tpcConfirmation'),
      TPC_Met_Person_2: safeGet(formData, 'tpcMetPerson2'),
      Name_of_TPC_2: safeGet(formData, 'nameOfTpc2') || safeGet(formData, 'tpcName2'),
      TPC_Confirmation_2: safeGet(formData, 'tpcConfirmation2'),
      
      // Landmarks
      Landmark_1: safeGet(formData, 'landmark1') || safeGet(formData, 'nearbyLandmark1'),
      Landmark_2: safeGet(formData, 'landmark2') || safeGet(formData, 'nearbyLandmark2'),
      Landmark_3: safeGet(formData, 'landmark3') || safeGet(formData, 'nearbyLandmark3') || 'Not provided',
      Landmark_4: safeGet(formData, 'landmark4') || safeGet(formData, 'nearbyLandmark4') || 'Not provided',
      
      // Area assessment
      Dominated_Area: safeGet(formData, 'dominatedArea'),
      Feedback_from_Neighbour: safeGet(formData, 'feedbackFromNeighbour') || safeGet(formData, 'neighborFeedback'),
      Political_Connection: safeGet(formData, 'politicalConnection'),
      Other_Observation: safeGet(formData, 'otherObservation') || safeGet(formData, 'remarks') || safeGet(formData, 'verifierComments'),
      Final_Status: safeGet(formData, 'finalStatus') || safeGet(formData, 'verificationOutcome') || 'Positive',

      // Call-related fields for Untraceable template
      Call_Remark: safeGet(formData, 'callRemark') || safeGet(formData, 'phoneCallRemark') || 'did not respond',

      // NSP-specific fields
      Staying_Person_Name: safeGet(formData, 'stayingPersonName') || safeGet(formData, 'actualResidentName') || 'Not provided',

      // Additional variables for shifted templates
      House_Status: safeGet(formData, 'houseStatus') || safeGet(formData, 'doorStatus'),
      Shifted_Period: safeGet(formData, 'shiftedPeriod') || safeGet(formData, 'shiftingSince'),
      Door_Name_Plate_Status: safeGet(formData, 'doorNamePlateStatus'),
      Society_Name_Plate_Status: safeGet(formData, 'societyNamePlateStatus'),
      Locality_Type: safeGet(formData, 'localityType') || safeGet(formData, 'locality'),
      Address_Structure: safeGet(formData, 'addressStructure'),
      Address_Floor: safeGet(formData, 'addressFloor') || safeGet(formData, 'floor'),
      Feedback_From_Neighbour: safeGet(formData, 'feedbackFromNeighbour') || safeGet(formData, 'neighborFeedback'),
      Premises_Status: safeGet(formData, 'premisesStatus') || safeGet(formData, 'currentPremisesStatus'),

      // Office-specific variables
      Office_Status: safeGet(formData, 'officeStatus') || safeGet(formData, 'office_status'),
      Designation: safeGet(formData, 'designation') || safeGet(formData, 'metPersonDesignation'),
      Working_Period: safeGet(formData, 'workingPeriod') || safeGet(formData, 'working_period'),
      Applicant_Designation: safeGet(formData, 'applicantDesignation') || safeGet(formData, 'applicant_designation'),
      Applicant_Working_Premises: safeGet(formData, 'applicantWorkingPremises') || safeGet(formData, 'applicant_working_premises'),
      Sitting_Location: safeGet(formData, 'sittingLocation') || safeGet(formData, 'sitting_location'),
      Office_Type: safeGet(formData, 'officeType') || safeGet(formData, 'office_type'),
      Company_Nature_Of_Business: safeGet(formData, 'companyNatureOfBusiness') || safeGet(formData, 'company_nature_of_business'),
      Staff_Strength: safeGet(formData, 'staffStrength') || safeGet(formData, 'staff_strength'),
      Staff_Seen: safeGet(formData, 'staffSeen') || safeGet(formData, 'staff_seen'),
      Office_Approx_Area: this.formatAreaSqFeet(formData, 'office'),
      Company_Name_Plate: safeGet(formData, 'companyNamePlateStatus') || safeGet(formData, 'company_nameplate_status'),
      Name_On_Board: safeGet(formData, 'nameOnCompanyBoard') || safeGet(formData, 'name_on_company_board'),

      // Office SHIFTED-specific variables
      Old_Office_Shifted_Period: safeGet(formData, 'oldOfficeShiftedPeriod') || safeGet(formData, 'old_office_shifted_period') || safeGet(formData, 'shiftedPeriod'),
      Current_Company_Name: safeGet(formData, 'currentCompanyName') || safeGet(formData, 'current_company_name') || safeGet(formData, 'companyName'),
      Current_Company_Period: safeGet(formData, 'currentCompanyPeriod') || safeGet(formData, 'current_company_period') || safeGet(formData, 'establishmentPeriod'),

      // Office ERT-specific variables
      Met_Person_Type: safeGet(formData, 'metPersonType') || safeGet(formData, 'met_person_type') || 'Security',
      Name_Of_Met_Person: safeGet(formData, 'nameOfMetPerson') || safeGet(formData, 'name_of_met_person') || safeGet(formData, 'metPersonName'),
      Met_Person_Confirmation: safeGet(formData, 'metPersonConfirmation') || safeGet(formData, 'met_person_confirmation') || 'confirmed',
      Office_Exist_Floor: safeGet(formData, 'officeExistFloor') || safeGet(formData, 'office_exist_floor') || safeGet(formData, 'addressFloor') || safeGet(formData, 'floor'),

      // Office NSP-specific variables
      Third_Party_Confirmation: safeGet(formData, 'thirdPartyConfirmation') || safeGet(formData, 'third_party_confirmation') || 'confirmed',
      Office_Existence: safeGet(formData, 'officeExistence') || safeGet(formData, 'office_existence') || 'exists',

      // Business-specific variables
      Business_Status: safeGet(formData, 'businessStatus') || safeGet(formData, 'business_status'),
      Business_Type: safeGet(formData, 'businessType') || safeGet(formData, 'business_type'),
      Business_Period: safeGet(formData, 'businessPeriod') || safeGet(formData, 'business_period'),
      Business_Approx_Area: this.formatAreaSqFeet(formData, 'business'),
      Business_Owner_Name: safeGet(formData, 'businessOwnerName') || safeGet(formData, 'business_owner_name') || safeGet(formData, 'nameOfCompanyOwners'),
      Business_Activity: safeGet(formData, 'businessActivity') || safeGet(formData, 'business_activity'),
      Business_Setup: safeGet(formData, 'businessSetup') || safeGet(formData, 'business_setup'),
      Business_Existence: safeGet(formData, 'businessExistence') || safeGet(formData, 'business_existence') || 'exists',
      Old_Business_Shifted_Period: safeGet(formData, 'oldBusinessShiftedPeriod') || safeGet(formData, 'old_business_shifted_period') || safeGet(formData, 'shiftedPeriod'),
      Establishment_Period: safeGet(formData, 'establishmentPeriod') || safeGet(formData, 'establishment_period')
    };
  }
}

export const templateReportService = new TemplateReportService();
