
export enum CaseStatus {
  Assigned = 'Assigned',
  InProgress = 'In Progress',
  Completed = 'Completed',
  Saved = 'Saved',
}

export enum VerificationType {
  Residence = 'Residence',
  ResidenceCumOffice = 'Residence-cum-office',
  Office = 'Office',
  Business = 'Business',
  Builder = 'Builder',
  NOC = 'NOC',
  Connector = 'DSA/DST & Connector',
  PropertyAPF = 'Property APF',
  PropertyIndividual = 'Property Individual',
}

export enum VerificationOutcome {
  PositiveAndDoorLocked = 'Positive & Door Locked',
  ShiftedAndDoorLocked = 'Shifted & Door Lock',
  NSPAndDoorLocked = 'NSP & Door Lock',
  ERT = 'ERT',
  Untraceable = 'Untraceable',
}

export enum RevokeReason {
    NotMyArea = 'Not my area',
    WrongPincode = 'Wrong pincode',
    NotWorking = 'Not working',
    LeftArea = 'Left area',
    WrongAddress = 'Wrong/incomplete address',
}

// Enums for Residence Report Form
export enum AddressLocatable {
  Easy = 'Easy to Locate',
  Difficult = 'Difficult to Locate',
  Poor = 'Poor to Locate',
}

export enum AddressRating {
  Good = 'Good',
  Shabby = 'Shabby',
  Poor = 'Poor',
}

export enum HouseStatus {
  Opened = 'Opened',
  Closed = 'Closed',
}

export enum Relation {
  Father = 'Father',
  Mother = 'Mother',
  Spouse = 'Spouse',
  Son = 'Son',
  Daughter = 'Daughter',
  Brother = 'Brother',
  Sister = 'Sister',
  Self = 'Self',
  Other = 'Other',
}

export enum WorkingStatus {
  Salaried = 'Salaried',
  SelfEmployed = 'Self Employed',
  HouseWife = 'House Wife',
}

export enum StayingStatus {
  Owned = 'On a Owned Basis',
  Rental = 'On a Rental Basis',
  ParentalOwned = 'On a Parental Owned Basis',
  Relative = 'On a Relative Basis',
  Pagadi = 'On a Pagadi System',
  StaffQuarters = 'In the Staff Quarters',
  PayingGuest = 'As a Paying Guest',
  CompanyAccomodation = 'On a Company Accomodation',
  BachelorAccomodation = 'In the Bachelor Accommodation',
  Hostel = 'In the Hostel',
}

export enum DocumentShownStatus {
  Showed = 'Showed',
  DidNotShow = 'Did Not Showed Any Document',
}

export enum DocumentType {
  ElectricityBill = 'Electricity Bill',
  AadharCard = 'Adhar Card',
  PanCard = 'Pan Card',
  Passport = 'Passport',
  RentDeed = 'Rent Deed',
}

export enum TPCConfirmation {
  Confirmed = 'Confirmed',
  NotConfirmed = 'Not Confirmed',
}

export enum TPCMetPerson {
  Neighbour = 'Neighbour',
  Security = 'Security',
}

export enum LocalityType {
  Tower = 'Tower / Building',
  RowHouse = 'Row House',
  Bunglow = 'Bunglow',
  IndependentHouse = 'Independent House',
  Chawl = 'Chawl / Slum',
  PatraShed = 'Patra Shed',
  SingleHouse = 'Single House',
}

export enum SightStatus {
  Sighted = 'Sighted',
  NotSighted = 'As / Not Sighted',
}

export enum PoliticalConnection {
  Yes = 'Having Political Connection',
  No = 'Not Having Political Connection',
}

export enum DominatedArea {
  Yes = 'A Community Dominated',
  No = 'Not a Community Dominated',
}

export enum FeedbackFromNeighbour {
  Adverse = 'Adverse',
  NoAdverse = 'No Adverse',
}

// Unified Final Status enum for all form types
export enum FinalStatus {
  Positive = 'Positive',
  Negative = 'Negative',
  Refer = 'Refer',
  Fraud = 'Fraud',
  Hold = 'Hold',
}

// Enums for Shifted Residence Report
export enum RoomStatusShifted {
    Opened = 'Opened',
    Closed = 'Closed',
}

export enum MetPersonStatusShifted {
    Owner = 'Owner',
    Tenant = 'Tenant',
}

export enum PremisesStatus {
    Vacant = 'Vacant',
    Rented = 'Rented',
}

// DEPRECATED: Use FinalStatus instead
// export enum FinalStatusShifted - Now using unified FinalStatus enum

// Enums for Entry Restricted Residence Report
export enum MetPersonErt {
    Security = 'Security',
    Receptionist = 'Receptionist',
}

export enum MetPersonConfirmationErt {
    Confirmed = 'Confirmed',
    NotConfirmed = 'Not Confirmed',
}

export enum ApplicantStayingStatusErt {
    StayingAt = 'Applicant is Staying At',
    ShiftedFrom = 'Applicant is Shifted From',
    NoSuchPerson = 'No Such Person Staying At',
}

// Enums for Untraceable Residence Report
export enum CallRemarkUntraceable {
    DidNotPickUp = 'Did Not Pick Up Call',
    SwitchedOff = 'Number is Switch Off',
    Unreachable = 'Number is Unreachable',
    RefusedToGuide = 'Refused to Guide Address',
}

// DEPRECATED: Use FinalStatus instead
// export enum FinalStatusUntraceable - Now using unified FinalStatus enum

// Enums for Positive Resi-cum-Office Report
export enum ResiCumOfficeStatus {
    Open = 'Opened',
    Closed = 'Closed',
}

export enum RelationResiCumOffice {
    Self = 'Self',
    Mother = 'Mother',
    Father = 'Father',
    Wife = 'Wife',
    Son = 'Son',
    Daughter = 'Daughter',
    Sister = 'Sister',
    Brother = 'Brother',
    Aunty = 'Aunty',
    Uncle = 'Uncle',
    MotherInLaw = 'Mother in Law',
    FatherInLaw = 'Father in Law',
    DaughterInLaw = 'Daughter in Law',
    SisterInLaw = 'Sister in Law',
    BrotherInLaw = 'Brother in Law',
    Other = 'Other',
}

export enum BusinessStatusResiCumOffice {
    SelfEmployee = 'Self Employee',
    Proprietorship = 'Proprietorship',
    PartnershipFirm = 'Partnership Firm',
    NA = 'NA',
}

export enum BusinessLocation {
    SameAddress = 'At Same Address',
    DifferentAddress = 'From Different Address',
}

export enum LocalityTypeResiCumOffice {
    CommercialTower = 'Commercial Tower',
    ResidentialBuilding = 'Residential Building',
    OfficeBuilding = 'Office Building',
    Bunglow = 'Bunglow',
    ShopLine = 'Shop Line',
    RowHouse = 'Row House',
    SingleHouse = 'Single House',
    ChawlSlum = 'Chawl / Slum',
    PatraShed = 'Patra Shed',
    GalaGodown = 'Gala / Godown',
    TeaStall = 'Tea Stall',
    SharingOffice = 'Sharing Office',
    RoadSide = 'Road Side',
    GovtOffice = 'Govt. Office',
    Bank = 'Bank',
    Cabin = 'Cabin',
    TableSpace = 'Table Space',
}

export enum AddressTraceable {
    Traceable = 'Traceable',
    Untraceable = 'Untraceable',
}

export enum BusinessStatusErtResiCumOffice {
    OfficeExist = 'Office Exist At',
    OfficeDoesNotExist = 'Office Does Not Exist At',
    OfficeShifted = 'Office Shifted From',
}

// Enums for Positive Office Report
export enum OfficeStatusOffice {
    Opened = 'Opened',
    Closed = 'Closed',
    Shifted = 'Shifted',
}

export enum DesignationOffice {
    Manager = 'Manager',
    Executive = 'Executive',
    Clerk = 'Clerk',
    Developer = 'Developer',
    Analyst = 'Analyst',
    Assistant = 'Assistant',
    Other = 'Other',
}

export enum WorkingStatusOffice {
    CompanyPayroll = 'Company Payroll',
    ThirdPartyPayroll = 'Third Party Payroll',
    ContractPayroll = 'Contract Payroll',
}

export enum ApplicantWorkingPremisesOffice {
    SameLocation = 'Same Location',
    DifferentLocation = 'Different Location',
}

export enum OfficeType {
    PvtLtd = 'PVT. LTD. Company',
    Ltd = 'LTD. Company',
    LLP = 'LLP Company',
    Govt = 'Govt. Office',
    Proprietorship = 'Proprietorship Firm',
    Partnership = 'Partnership Firm',
    PublicLtd = 'Public Ltd. Company',
}

// Enums for Shifted Office Report
export enum DesignationShiftedOffice {
    ApplicantSelf = 'Applicant Self',
    Reception = 'Reception',
    ReceptionSecurity = 'Reception Security',
    CompanySecurity = 'Company Security',
    ManagerHR = 'Manager / H.R.',
    SrOfficer = 'SR. Officer',
    Accountant = 'Accountant',
    Admin = 'Admin',
    OfficeStaff = 'Office Staff',
    Clerk = 'Clark',
    Principal = 'Principal',
    Other = 'Other',
}

// DEPRECATED: Use FinalStatus instead
// export enum FinalStatusShiftedOffice - Now using unified FinalStatus enum

// Enums for NSP Office Report
export enum OfficeExistence {
    Exist = 'Exist',
    DoesNotExist = 'Does Not Exist',
}

// Enums for ERT Office Report
export enum OfficeStatusErtOffice {
    OfficeExistAt = 'Office Exist At',
    OfficeDoesNotExistAt = 'Office Does Not Exist At',
    OfficeShiftedFrom = 'Office Shifted From',
}

// Enums for Positive Business Report
export enum BusinessType {
    PvtLtd = 'PVT. LTD. Company',
    Ltd = 'LTD. Company',
    LLP = 'LLP Company',
    Proprietorship = 'Proprietorship Firm',
    Partnership = 'Partnership Firm',
}

export enum OwnershipTypeBusiness {
    Partners = 'Are Partners',
    Directors = 'Are Directors',
    Proprietor = 'Is Proprietor',
}

export enum AddressStatusBusiness {
    SelfOwned = 'On a Self Owned Basis',
    Rental = 'On a Rental Basis',
    Pagadi = 'On a Pagadi System',
    SharedWorkplace = 'In Share Work Place',
}

// Enums for Shifted Business Report
export enum PremisesStatusBusiness {
    Vacant = 'Vacant',
    RentedTo = 'Rented To',
    OwnedBy = 'Owned By',
}

// DEPRECATED: Use FinalStatus instead
// export enum FinalStatusShiftedBusiness - Now using unified FinalStatus enum

// Enums for NSP Business Report
export enum BusinessExistence {
    Exist = 'Exist',
    DoesNotExist = 'Does Not Exist',
}

export enum ApplicantExistence {
    Exist = 'Exist',
    DoesNotExist = 'Does Not Exist',
}

// Enums for ERT Business Report
export enum OfficeStatusErtBusiness {
    Exist = 'Business Exist At',
    DoesNotExist = 'Business Does Not Exist At',
    Shifted = 'Business Shifted From',
}

// Enums for NOC Report
export enum DesignationNoc {
    Chairman = 'Chairman',
    Secretary = 'Secretary',
    Treasurer = 'Treasurer',
    SocietyManager = 'Society Manager',
    Proprietor = 'Proprietor',
    Partner = 'Partner',
    Director = 'Director',
    Tenant = 'Tenant',
    Other = 'Other',
}

export enum OfficeStatusErtNoc {
    Exist = 'Office Exist At',
    DoesNotExist = 'Office Does Not Exist At',
    Shifted = 'Office Shifted From',
}

// Enums for ERT DSA/DST Report
export enum OfficeStatusErtDsa {
    Exist = 'Business Exist At',
    DoesNotExist = 'Business Does Not Exist At',
    Shifted = 'Business Shifted From',
}

// Enums for Property APF Report
export enum BuildingStatusApf {
    NewConstruction = 'New Construction',
    Redeveloped = 'Redeveloped Construction',
    UnderConstruction = 'Under Construction',
    VacantPlace = 'Vacant Place',
}

export enum FlatStatusApf {
    Opened = 'Open',
    Closed = 'Closed',
}

export enum RelationshipApf {
    Self = 'Self',
    Mother = 'Mother',
    Father = 'Father',
    Wife = 'Wife',
    Son = 'Son',
    Daughter = 'Daughter',
    Sister = 'Sister',
    Brother = 'Brother',
    Aunty = 'Aunty',
    Uncle = 'Uncle',
    MotherInLaw = 'Mother in Law',
    FatherInLaw = 'Father in Law',
    DaughterInLaw = 'Daughter in Law',
    SisterInLaw = 'Sister in Law',
    BrotherInLaw = 'Brother in Law',
    Other = 'Other',
}

export interface CapturedImage {
  id: string;
  dataUrl: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  componentType?: 'photo' | 'selfie'; // Added to distinguish between regular photos and selfies for auto-save
  geoLocation?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    timestamp?: string;
    address?: string;
  };
  // Browser optimization properties
  compressed?: boolean;
  originalSize?: number;
  compressedSize?: number;
}

export interface Attachment {
  id: string;
  name: string;
  type: 'pdf' | 'image';
  mimeType: 'application/pdf' | 'image/jpeg' | 'image/jpg' | 'image/png';
  size: number; // Size in bytes (max 10MB = 10485760 bytes)
  url: string;
  thumbnailUrl?: string; // For images only
  uploadedAt: string; // ISO timestamp
  uploadedBy: string;
  description?: string;
}

export interface ResidenceReportData {
  addressLocatable: AddressLocatable | null;
  addressRating: AddressRating | null;
  houseStatus: HouseStatus | null;
  metPersonName: string;
  metPersonRelation: Relation | null;
  totalFamilyMembers: number | null;
  totalEarning: number | null;
  workingStatus: WorkingStatus | null;
  companyName: string;
  stayingPeriod: string;
  stayingStatus: StayingStatus | null;
  approxArea: number | null;
  documentShownStatus: DocumentShownStatus | null;
  documentType: DocumentType | null;
  tpcMetPerson1: TPCMetPerson | null;
  tpcName1: string;
  tpcConfirmation1: TPCConfirmation | null;
  tpcMetPerson2: TPCMetPerson | null;
  tpcName2: string;
  tpcConfirmation2: TPCConfirmation | null;
  locality: LocalityType | null;
  addressStructure: string;
  applicantStayingFloor: string;
  addressStructureColor: string;
  doorColor: string;
  doorNamePlateStatus: SightStatus | null;
  nameOnDoorPlate: string;
  societyNamePlateStatus: SightStatus | null;
  nameOnSocietyBoard: string;
  landmark1: string;
  landmark2: string;
  politicalConnection: PoliticalConnection | null;
  dominatedArea: DominatedArea | null;
  feedbackFromNeighbour: FeedbackFromNeighbour | null;
  otherObservation: string;
  finalStatus: FinalStatus | null;
  holdReason: string;
  images: CapturedImage[];
  selfieImages: CapturedImage[];
}

export interface ShiftedResidenceReportData {
    addressLocatable: AddressLocatable | null;
    addressRating: AddressRating | null;
    roomStatus: RoomStatusShifted | null;
    metPersonName: string;
    metPersonStatus: MetPersonStatusShifted | null;
    shiftedPeriod: string;
    tpcMetPerson1: TPCMetPerson | null;
    tpcName1: string;
    tpcMetPerson2: TPCMetPerson | null;
    tpcName2: string;
    premisesStatus: PremisesStatus | null;
    locality: LocalityType | null;
    addressStructure: string;
    addressFloor: string;
    addressStructureColor: string;
    doorColor: string;
    doorNamePlateStatus: SightStatus | null;
    nameOnDoorPlate: string;
    societyNamePlateStatus: SightStatus | null;
    nameOnSocietyBoard: string;
    landmark1: string;
    landmark2: string;
    politicalConnection: PoliticalConnection | null;
    dominatedArea: DominatedArea | null;
    feedbackFromNeighbour: FeedbackFromNeighbour | null;
    otherObservation: string;
    finalStatus: FinalStatus | null;
    holdReason: string;
    images: CapturedImage[];
    selfieImages: CapturedImage[];
}

export interface NspResidenceReportData {
    addressLocatable: AddressLocatable | null;
    addressRating: AddressRating | null;
    houseStatus: HouseStatus | null;
    // Fields for when HouseStatus is 'Opened'
    metPersonName: string;
    metPersonStatus: MetPersonStatusShifted | null;
    stayingPeriod: string;
    tpcMetPerson1: TPCMetPerson | null;
    tpcName1: string;
    tpcMetPerson2: TPCMetPerson | null;
    tpcName2: string;
    // Field for when HouseStatus is 'Closed'
    stayingPersonName: string;
    // Common fields
    locality: LocalityType | null;
    addressStructure: string;
    applicantStayingFloor: string;
    addressStructureColor: string;
    doorColor: string;
    doorNamePlateStatus: SightStatus | null;
    nameOnDoorPlate: string;
    societyNamePlateStatus: SightStatus | null;
    nameOnSocietyBoard: string;
    landmark1: string;
    landmark2: string;
    politicalConnection: PoliticalConnection | null;
    dominatedArea: DominatedArea | null;
    feedbackFromNeighbour: FeedbackFromNeighbour | null;
    otherObservation: string;
    finalStatus: FinalStatus | null;
    holdReason: string;
    images: CapturedImage[];
    selfieImages: CapturedImage[];
}

export interface EntryRestrictedResidenceReportData {
    addressLocatable: AddressLocatable | null;
    addressRating: AddressRating | null;
    nameOfMetPerson: string;
    metPerson: MetPersonErt | null;
    metPersonConfirmation: MetPersonConfirmationErt | null;
    applicantStayingStatus: ApplicantStayingStatusErt | null;
    locality: LocalityType | null;
    addressStructure: string;
    applicantStayingFloor: string;
    addressStructureColor: string;
    societyNamePlateStatus: SightStatus | null;
    nameOnSocietyBoard: string;
    landmark1: string;
    landmark2: string;
    politicalConnection: PoliticalConnection | null;
    dominatedArea: DominatedArea | null;
    feedbackFromNeighbour: FeedbackFromNeighbour | null;
    otherObservation: string;
    finalStatus: FinalStatus | null;
    holdReason: string;
    images: CapturedImage[];
    selfieImages: CapturedImage[];
}

export interface UntraceableResidenceReportData {
    metPerson: string;
    callRemark: CallRemarkUntraceable | null;
    locality: LocalityType | null;
    landmark1: string;
    landmark2: string;
    landmark3: string;
    landmark4: string;
    dominatedArea: DominatedArea | null;
    otherObservation: string;
    finalStatus: FinalStatus | null;
    holdReason: string;
    images: CapturedImage[];
    selfieImages: CapturedImage[];
}

export interface ResiCumOfficeReportData {
    addressLocatable: AddressLocatable | null;
    addressRating: AddressRating | null;
    resiCumOfficeStatus: ResiCumOfficeStatus | null;
    residenceSetup: SightStatus | null;
    businessSetup: SightStatus | null;
    metPerson: string;
    relation: RelationResiCumOffice | null;
    stayingPeriod: string;
    stayingStatus: StayingStatus | null;
    companyNatureOfBusiness: string;
    businessPeriod: string;
    businessStatus: BusinessStatusResiCumOffice | null;
    businessLocation: BusinessLocation | null;
    businessOperatingAddress: string;
    approxArea: number | null;
    documentShownStatus: DocumentShownStatus | null;
    documentType: DocumentType | null;
    tpcMetPerson1: TPCMetPerson | null;
    tpcName1: string;
    tpcConfirmation1: TPCConfirmation | null;
    tpcMetPerson2: TPCMetPerson | null;
    tpcName2: string;
    tpcConfirmation2: TPCConfirmation | null;
    locality: LocalityTypeResiCumOffice | null;
    addressStructure: string;
    applicantStayingFloor: string;
    addressStructureColor: string;
    doorColor: string;
    doorNamePlateStatus: SightStatus | null;
    nameOnDoorPlate: string;
    societyNamePlateStatus: SightStatus | null;
    nameOnSocietyBoard: string;
    companyNamePlateStatus: SightStatus | null;
    nameOnBoard: string;
    landmark1: string;
    landmark2: string;
    politicalConnection: PoliticalConnection | null;
    dominatedArea: DominatedArea | null;
    feedbackFromNeighbour: FeedbackFromNeighbour | null;
    otherObservation: string;
    finalStatus: FinalStatus | null;
    holdReason: string;
    images: CapturedImage[];
    selfieImages: CapturedImage[];
}

export interface ShiftedResiCumOfficeReportData {
    addressLocatable: AddressLocatable | null;
    addressRating: AddressRating | null;
    resiCumOfficeStatus: ResiCumOfficeStatus | null;
    metPerson: string;
    metPersonStatus: MetPersonStatusShifted | null;
    shiftedPeriod: string;
    tpcMetPerson1: TPCMetPerson | null;
    tpcName1: string;
    tpcMetPerson2: TPCMetPerson | null;
    tpcName2: string;
    locality: LocalityTypeResiCumOffice | null;
    addressStructure: string;
    addressFloor: string;
    addressStructureColor: string;
    doorColor: string;
    doorNamePlateStatus: SightStatus | null;
    nameOnDoorPlate: string;
    societyNamePlateStatus: SightStatus | null;
    nameOnSocietyBoard: string;
    landmark1: string;
    landmark2: string;
    politicalConnection: PoliticalConnection | null;
    dominatedArea: DominatedArea | null;
    feedbackFromNeighbour: FeedbackFromNeighbour | null;
    otherObservation: string;
    finalStatus: FinalStatus | null;
    holdReason: string;
    images: CapturedImage[];
    selfieImages: CapturedImage[];
}

export interface NspResiCumOfficeReportData {
    addressTraceable: AddressTraceable | null;
    addressLocatable: AddressLocatable | null;
    addressRating: AddressRating | null;
    resiCumOfficeStatus: ResiCumOfficeStatus | null;
    // Fields for when status is 'Open'
    metPerson: string;
    metPersonStatus: MetPersonStatusShifted | null;
    stayingPeriod: string;
    tpcMetPerson1: TPCMetPerson | null;
    tpcName1: string;
    tpcMetPerson2: TPCMetPerson | null;
    tpcName2: string;
    // Field for when status is 'Closed'
    stayingPersonName: string;
    // Common fields
    locality: LocalityTypeResiCumOffice | null;
    addressStructure: string;
    applicantStayingFloor: string;
    addressStructureColor: string;
    doorColor: string;
    doorNamePlateStatus: SightStatus | null;
    nameOnDoorPlate: string;
    societyNamePlateStatus: SightStatus | null;
    nameOnSocietyBoard: string;
    landmark1: string;
    landmark2: string;
    dominatedArea: DominatedArea | null;
    otherObservation: string;
    finalStatus: FinalStatus | null;
    holdReason: string;
    images: CapturedImage[];
    selfieImages: CapturedImage[];
}

export interface EntryRestrictedResiCumOfficeReportData {
    addressLocatable: AddressLocatable | null;
    addressRating: AddressRating | null;
    metPerson: MetPersonErt | null;
    nameOfMetPerson: string;
    metPersonConfirmation: MetPersonConfirmationErt | null;
    applicantStayingStatus: ApplicantStayingStatusErt | null;
    businessStatus: BusinessStatusErtResiCumOffice | null;
    societyNamePlateStatus: SightStatus | null;
    nameOnSocietyBoard: string;
    locality: LocalityTypeResiCumOffice | null;
    addressStructure: string;
    addressStructureColor: string;
    landmark1: string;
    landmark2: string;
    politicalConnection: PoliticalConnection | null;
    dominatedArea: DominatedArea | null;
    feedbackFromNeighbour: FeedbackFromNeighbour | null;
    otherObservation: string;
    finalStatus: FinalStatus | null;
    holdReason: string;
    images: CapturedImage[];
    selfieImages: CapturedImage[];
}

export interface UntraceableResiCumOfficeReportData {
    metPerson: string;
    callRemark: CallRemarkUntraceable | null;
    locality: LocalityTypeResiCumOffice | null;
    landmark1: string;
    landmark2: string;
    landmark3: string;
    landmark4: string;
    dominatedArea: DominatedArea | null;
    otherObservation: string;
    finalStatus: FinalStatus | null;
    holdReason: string;
    images: CapturedImage[];
    selfieImages: CapturedImage[];
}

export interface PositiveOfficeReportData {
    addressLocatable: AddressLocatable | null;
    addressRating: AddressRating | null;
    officeStatus: OfficeStatusOffice | null;
    metPerson: string;
    designation: DesignationOffice | null;
    workingPeriod: string;
    applicantDesignation: DesignationOffice | null;
    workingStatus: WorkingStatusOffice | null;
    applicantWorkingPremises: ApplicantWorkingPremisesOffice | null;
    sittingLocation: string;
    officeType: OfficeType | null;
    companyNatureOfBusiness: string;
    staffStrength: number | null;
    staffSeen: number | null;
    officeApproxArea: number | null;
    companyNamePlateStatus: SightStatus | null;
    nameOnBoard: string;
    documentShown: string;
    tpcMetPerson1: TPCMetPerson | null;
    nameOfTpc1: string;
    tpcConfirmation1: TPCConfirmation | null;
    tpcMetPerson2: TPCMetPerson | null;
    nameOfTpc2: string;
    tpcConfirmation2: TPCConfirmation | null;
    establishmentPeriod: string;
    locality: LocalityTypeResiCumOffice | null;
    addressStructure: string;
    addressStructureColor: string;
    doorColor: string;
    landmark1: string;
    landmark2: string;
    politicalConnection: PoliticalConnection | null;
    dominatedArea: DominatedArea | null;
    feedbackFromNeighbour: FeedbackFromNeighbour | null;
    otherObservation: string;
    finalStatus: FinalStatus | null;
    holdReason: string;
    outcome: string;
    images: CapturedImage[];
    selfieImages: CapturedImage[];
}

export interface ShiftedOfficeReportData {
    addressLocatable: AddressLocatable | null;
    addressRating: AddressRating | null;
    officeStatus: OfficeStatusOffice | null;
    metPerson: string;
    designation: DesignationShiftedOffice | null;
    currentCompanyName: string;
    currentCompanyPeriod: string;
    oldOfficeShiftedPeriod: string;
    officeApproxArea: number | null;
    companyNamePlateStatus: SightStatus | null;
    nameOnBoard: string;
    tpcMetPerson1: TPCMetPerson | null;
    nameOfTpc1: string;
    tpcConfirmation1: TPCConfirmation | null;
    tpcMetPerson2: TPCMetPerson | null;
    nameOfTpc2: string;
    tpcConfirmation2: TPCConfirmation | null;
    locality: LocalityTypeResiCumOffice | null;
    addressStructure: string;
    addressStructureColor: string;
    doorColor: string;
    landmark1: string;
    landmark2: string;
    politicalConnection: PoliticalConnection | null;
    dominatedArea: DominatedArea | null;
    feedbackFromNeighbour: FeedbackFromNeighbour | null;
    otherObservation: string;
    finalStatus: FinalStatus | null;
    holdReason: string;
    outcome: string;
    images: CapturedImage[];
    selfieImages: CapturedImage[];
}

export interface NspOfficeReportData {
    addressLocatable: AddressLocatable | null;
    addressRating: AddressRating | null;
    officeStatus: OfficeStatusOffice | null;
    officeExistence: OfficeExistence | null;
    currentCompanyName: string;
    metPerson: string;
    designation: DesignationShiftedOffice | null;
    companyNamePlateStatus: SightStatus | null;
    nameOnBoard: string;
    tpcMetPerson1: TPCMetPerson | null;
    nameOfTpc1: string;
    tpcConfirmation1: TPCConfirmation | null;
    tpcMetPerson2: TPCMetPerson | null;
    nameOfTpc2: string;
    tpcConfirmation2: TPCConfirmation | null;
    locality: LocalityTypeResiCumOffice | null;
    addressStructure: string;
    addressStructureColor: string;
    doorColor: string;
    landmark1: string;
    landmark2: string;
    dominatedArea: DominatedArea | null;
    feedbackFromNeighbour: FeedbackFromNeighbour | null;
    otherObservation: string;
    finalStatus: FinalStatus | null;
    holdReason: string;
    outcome: string;
    images: CapturedImage[];
    selfieImages: CapturedImage[];
}

export interface EntryRestrictedOfficeReportData {
    addressLocatable: AddressLocatable | null;
    addressRating: AddressRating | null;
    metPerson: MetPersonErt | null;
    nameOfMetPerson: string;
    metPersonConfirmation: TPCConfirmation | null;
    officeStatus: OfficeStatusErtOffice | null;
    locality: LocalityTypeResiCumOffice | null;
    addressStructure: string;
    officeExistFloor: string;
    addressStructureColor: string;
    landmark1: string;
    landmark2: string;
    politicalConnection: PoliticalConnection | null;
    dominatedArea: DominatedArea | null;
    feedbackFromNeighbour: FeedbackFromNeighbour | null;
    otherObservation: string;
    finalStatus: FinalStatus | null;
    holdReason: string;
    outcome: string;
    images: CapturedImage[];
    selfieImages: CapturedImage[];
}

export interface UntraceableOfficeReportData {
    metPerson: string;
    callRemark: CallRemarkUntraceable | null;
    locality: LocalityTypeResiCumOffice | null;
    landmark1: string;
    landmark2: string;
    landmark3: string;
    landmark4: string;
    dominatedArea: DominatedArea | null;
    otherObservation: string;
    finalStatus: FinalStatus | null;
    holdReason: string;
    outcome: string;
    images: CapturedImage[];
    selfieImages: CapturedImage[];
}

export interface PositiveBusinessReportData {
    addressLocatable: AddressLocatable | null;
    addressRating: AddressRating | null;
    officeStatus: OfficeStatusOffice | null;
    metPerson: string;
    designation: DesignationShiftedOffice | null;
    businessType: BusinessType | null;
    nameOfCompanyOwners: string;
    ownershipType: OwnershipTypeBusiness | null;
    addressStatus: AddressStatusBusiness | null;
    companyNatureOfBusiness: string;
    businessPeriod: string;
    officeApproxArea: number | null;
    staffStrength: number | null;
    staffSeen: number | null;
    companyNamePlateStatus: SightStatus | null;
    nameOnBoard: string;
    documentShown: string;
    tpcMetPerson1: TPCMetPerson | null;
    nameOfTpc1: string;
    tpcConfirmation1: TPCConfirmation | null;
    tpcMetPerson2: TPCMetPerson | null;
    nameOfTpc2: string;
    tpcConfirmation2: TPCConfirmation | null;
    locality: LocalityTypeResiCumOffice | null;
    addressStructure: string;
    addressStructureColor: string;
    doorColor: string;
    landmark1: string;
    landmark2: string;
    politicalConnection: PoliticalConnection | null;
    dominatedArea: DominatedArea | null;
    feedbackFromNeighbour: FeedbackFromNeighbour | null;
    otherObservation: string;
    finalStatus: FinalStatus | null;
    holdReason: string;
    images: CapturedImage[];
    selfieImages: CapturedImage[];
}

export interface ShiftedBusinessReportData {
    addressLocatable: AddressLocatable | null;
    addressRating: AddressRating | null;
    officeStatus: OfficeStatusOffice | null;
    metPerson: string;
    designation: DesignationShiftedOffice | null;
    premisesStatus: PremisesStatusBusiness | null;
    currentCompanyName: string;
    currentCompanyPeriod: string;
    oldOfficeShiftedPeriod: string;
    approxArea: number | null;
    tpcMetPerson: TPCMetPerson | null;
    nameOfTpc: string;
    tpcConfirmation1: TPCConfirmation | null;
    tpcMetPerson2: TPCMetPerson | null;
    nameOfTpc2: string;
    tpcConfirmation2: TPCConfirmation | null;
    companyNamePlateStatus: SightStatus | null;
    nameOnBoard: string;
    locality: LocalityTypeResiCumOffice | null;
    addressStructure: string;
    addressStructureColor: string;
    doorColor: string;
    landmark1: string;
    landmark2: string;
    politicalConnection: PoliticalConnection | null;
    dominatedArea: DominatedArea | null;
    feedbackFromNeighbour: FeedbackFromNeighbour | null;
    otherObservation: string;
    finalStatus: FinalStatus | null;
    holdReason: string;
    images: CapturedImage[];
    selfieImages: CapturedImage[];
}

export interface NspBusinessReportData {
    addressLocatable: AddressLocatable | null;
    addressRating: AddressRating | null;
    officeStatus: OfficeStatusOffice | null;
    businessExistance: BusinessExistence | null;
    applicantExistance: ApplicantExistence | null;
    metPerson: string;
    designation: DesignationShiftedOffice | null;
    premisesStatus: PremisesStatusBusiness | null;
    currentCompanyName: string;
    companyNamePlateStatus: SightStatus | null;
    nameOnBoard: string;
    tpcMetPerson1: TPCMetPerson | null;
    nameOfTpc1: string;
    tpcConfirmation1: TPCConfirmation | null;
    tpcMetPerson2: TPCMetPerson | null;
    nameOfTpc2: string;
    tpcConfirmation2: TPCConfirmation | null;
    locality: LocalityTypeResiCumOffice | null;
    addressStructure: string;
    addressStructureColor: string;
    doorColor: string;
    landmark1: string;
    landmark2: string;
    dominatedArea: DominatedArea | null;
    feedbackFromNeighbour: FeedbackFromNeighbour | null;
    otherObservation: string;
    finalStatus: FinalStatus | null;
    holdReason: string;
    images: CapturedImage[];
    selfieImages: CapturedImage[];
}

export interface EntryRestrictedBusinessReportData {
    addressLocatable: AddressLocatable | null;
    addressRating: AddressRating | null;
    metPerson: MetPersonErt | null;
    nameOfMetPerson: string;
    metPersonConfirmation: TPCConfirmation | null;
    officeStatus: OfficeStatusErtBusiness | null;
    locality: LocalityTypeResiCumOffice | null;
    addressStructure: string;
    addressStructureColor: string;
    landmark1: string;
    landmark2: string;
    politicalConnection: PoliticalConnection | null;
    dominatedArea: DominatedArea | null;
    feedbackFromNeighbour: FeedbackFromNeighbour | null;
    otherObservation: string;
    finalStatus: FinalStatus | null;
    holdReason: string;
    images: CapturedImage[];
    selfieImages: CapturedImage[];
}

export interface UntraceableBusinessReportData {
    metPerson: string;
    callRemark: CallRemarkUntraceable | null;
    locality: LocalityTypeResiCumOffice | null;
    landmark1: string;
    landmark2: string;
    landmark3: string;
    landmark4: string;
    dominatedArea: DominatedArea | null;
    otherObservation: string;
    finalStatus: FinalStatus | null;
    holdReason: string;
    images: CapturedImage[];
    selfieImages: CapturedImage[];
}

export interface PositiveBuilderReportData {
    addressLocatable: AddressLocatable | null;
    addressRating: AddressRating | null;
    officeStatus: OfficeStatusOffice | null;
    metPerson: string;
    designation: DesignationShiftedOffice | null;
    businessType: BusinessType | null;
    nameOfCompanyOwners: string;
    ownershipType: OwnershipTypeBusiness | null;
    addressStatus: AddressStatusBusiness | null;
    companyNatureOfBusiness: string;
    businessPeriod: string;
    officeApproxArea: number | null;
    staffStrength: number | null;
    staffSeen: number | null;
    companyNamePlateStatus: SightStatus | null;
    nameOnBoard: string;
    documentShown: string;
    tpcMetPerson1: TPCMetPerson | null;
    nameOfTpc1: string;
    tpcConfirmation1: TPCConfirmation | null;
    tpcMetPerson2: TPCMetPerson | null;
    nameOfTpc2: string;
    tpcConfirmation2: TPCConfirmation | null;
    locality: LocalityTypeResiCumOffice | null;
    addressStructure: string;
    addressStructureColor: string;
    doorColor: string;
    landmark1: string;
    landmark2: string;
    politicalConnection: PoliticalConnection | null;
    dominatedArea: DominatedArea | null;
    feedbackFromNeighbour: FeedbackFromNeighbour | null;
    otherObservation: string;
    finalStatus: FinalStatus | null;
    holdReason: string;
    images: CapturedImage[];
    selfieImages: CapturedImage[];
}

export interface ShiftedBuilderReportData {
    addressLocatable: AddressLocatable | null;
    addressRating: AddressRating | null;
    officeStatus: OfficeStatusOffice | null;
    metPerson: string;
    designation: DesignationShiftedOffice | null;
    premisesStatus: PremisesStatusBusiness | null;
    currentCompanyName: string;
    currentCompanyPeriod: string;
    oldOfficeShiftedPeriod: string;
    approxArea: number | null;
    tpcMetPerson: TPCMetPerson | null;
    nameOfTpc: string;
    tpcConfirmation1: TPCConfirmation | null;
    tpcMetPerson2: TPCMetPerson | null;
    nameOfTpc2: string;
    tpcConfirmation2: TPCConfirmation | null;
    companyNamePlateStatus: SightStatus | null;
    nameOnBoard: string;
    locality: LocalityTypeResiCumOffice | null;
    addressStructure: string;
    addressStructureColor: string;
    doorColor: string;
    landmark1: string;
    landmark2: string;
    politicalConnection: PoliticalConnection | null;
    dominatedArea: DominatedArea | null;
    feedbackFromNeighbour: FeedbackFromNeighbour | null;
    otherObservation: string;
    finalStatus: FinalStatus | null;
    holdReason: string;
    images: CapturedImage[];
    selfieImages: CapturedImage[];
}

export interface NspBuilderReportData {
    addressLocatable: AddressLocatable | null;
    addressRating: AddressRating | null;
    officeStatus: OfficeStatusOffice | null;
    businessExistance: BusinessExistence | null;
    applicantExistance: ApplicantExistence | null;
    metPerson: string;
    designation: DesignationShiftedOffice | null;
    premisesStatus: PremisesStatusBusiness | null;
    currentCompanyName: string;
    companyNamePlateStatus: SightStatus | null;
    nameOnBoard: string;
    tpcMetPerson1: TPCMetPerson | null;
    nameOfTpc1: string;
    tpcConfirmation1: TPCConfirmation | null;
    tpcMetPerson2: TPCMetPerson | null;
    nameOfTpc2: string;
    tpcConfirmation2: TPCConfirmation | null;
    locality: LocalityTypeResiCumOffice | null;
    addressStructure: string;
    addressStructureColor: string;
    doorColor: string;
    landmark1: string;
    landmark2: string;
    dominatedArea: DominatedArea | null;
    feedbackFromNeighbour: FeedbackFromNeighbour | null;
    otherObservation: string;
    finalStatus: FinalStatus | null;
    holdReason: string;
    images: CapturedImage[];
    selfieImages: CapturedImage[];
}

export interface EntryRestrictedBuilderReportData {
    addressLocatable: AddressLocatable | null;
    addressRating: AddressRating | null;
    metPerson: MetPersonErt | null;
    nameOfMetPerson: string;
    metPersonConfirmation: TPCConfirmation | null;
    officeStatus: OfficeStatusErtBusiness | null;
    locality: LocalityTypeResiCumOffice | null;
    addressStructure: string;
    addressStructureColor: string;
    landmark1: string;
    landmark2: string;
    politicalConnection: PoliticalConnection | null;
    dominatedArea: DominatedArea | null;
    feedbackFromNeighbour: FeedbackFromNeighbour | null;
    otherObservation: string;
    finalStatus: FinalStatus | null;
    holdReason: string;
    images: CapturedImage[];
    selfieImages: CapturedImage[];
}

export interface UntraceableBuilderReportData {
    metPerson: string;
    callRemark: CallRemarkUntraceable | null;
    locality: LocalityTypeResiCumOffice | null;
    landmark1: string;
    landmark2: string;
    landmark3: string;
    landmark4: string;
    dominatedArea: DominatedArea | null;
    otherExtraRemark: string;
    finalStatus: FinalStatus | null;
    holdReason: string;
    images: CapturedImage[];
    selfieImages: CapturedImage[];
}

export interface PositiveNocReportData {
    addressLocatable: AddressLocatable | null;
    addressRating: AddressRating | null;
    officeStatus: OfficeStatusOffice | null;
    metPerson: string;
    designation: DesignationNoc | null;
    authorisedSignature: string;
    nameOnNoc: string;
    flatNo: string;
    locality: LocalityTypeResiCumOffice | null;
    addressStructure: string;
    addressStructureColor: string;
    landmark1: string;
    landmark2: string;
    politicalConnection: PoliticalConnection | null;
    dominatedArea: DominatedArea | null;
    feedbackFromNeighbour: FeedbackFromNeighbour | null;
    otherExtraRemark: string;
    finalStatus: FinalStatus | null;
    holdReason: string;
    images: CapturedImage[];
    selfieImages: CapturedImage[];
}

export interface ShiftedNocReportData {
    addressLocatable: AddressLocatable | null;
    addressRating: AddressRating | null;
    officeStatus: OfficeStatusOffice | null;
    metPerson: string;
    designation: DesignationNoc | null;
    currentCompanyName: string;
    currentCompanyPeriod: string;
    oldOfficeShiftedPeriod: string;
    officeApproxArea: number | null;
    companyNamePlateStatus: SightStatus | null;
    nameOnBoard: string;
    tpcMetPerson1: TPCMetPerson | null;
    nameOfTpc1: string;
    tpcConfirmation1: TPCConfirmation | null;
    tpcMetPerson2: TPCMetPerson | null;
    nameOfTpc2: string;
    tpcConfirmation2: TPCConfirmation | null;
    locality: LocalityTypeResiCumOffice | null;
    addressStructure: string;
    addressStructureColor: string;
    doorColor: string;
    landmark1: string;
    landmark2: string;
    politicalConnection: PoliticalConnection | null;
    dominatedArea: DominatedArea | null;
    feedbackFromNeighbour: FeedbackFromNeighbour | null;
    otherObservation: string;
    finalStatus: FinalStatus | null;
    holdReason: string;
    images: CapturedImage[];
    selfieImages: CapturedImage[];
}

export interface NspNocReportData {
    addressLocatable: AddressLocatable | null;
    addressRating: AddressRating | null;
    officeStatus: OfficeStatusOffice | null;
    businessExistance: BusinessExistence | null;
    applicantExistance: ApplicantExistence | null;
    metPerson: string;
    designation: DesignationShiftedOffice | null;
    premisesStatus: PremisesStatusBusiness | null;
    currentCompanyName: string;
    companyNamePlateStatus: SightStatus | null;
    nameOnBoard: string;
    tpcMetPerson1: TPCMetPerson | null;
    nameOfTpc1: string;
    tpcConfirmation1: TPCConfirmation | null;
    tpcMetPerson2: TPCMetPerson | null;
    nameOfTpc2: string;
    tpcConfirmation2: TPCConfirmation | null;
    locality: LocalityTypeResiCumOffice | null;
    addressStructure: string;
    addressStructureColor: string;
    doorColor: string;
    landmark1: string;
    landmark2: string;
    dominatedArea: DominatedArea | null;
    feedbackFromNeighbour: FeedbackFromNeighbour | null;
    otherObservation: string;
    finalStatus: FinalStatus | null;
    holdReason: string;
    images: CapturedImage[];
    selfieImages: CapturedImage[];
}

export interface EntryRestrictedNocReportData {
    addressLocatable: AddressLocatable | null;
    addressRating: AddressRating | null;
    metPerson: MetPersonErt | null;
    nameOfMetPerson: string;
    metPersonConfirmation: TPCConfirmation | null;
    officeStatus: OfficeStatusErtNoc | null;
    locality: LocalityTypeResiCumOffice | null;
    addressStructure: string;
    addressStructureColor: string;
    landmark1: string;
    landmark2: string;
    politicalConnection: PoliticalConnection | null;
    dominatedArea: DominatedArea | null;
    feedbackFromNeighbour: FeedbackFromNeighbour | null;
    otherObservation: string;
    finalStatus: FinalStatus | null;
    holdReason: string;
    images: CapturedImage[];
    selfieImages: CapturedImage[];
}

export interface UntraceableNocReportData {
    contactPerson: string;
    metPerson: string;
    callRemark: CallRemarkUntraceable | null;
    locality: LocalityTypeResiCumOffice | null;
    landmark1: string;
    landmark2: string;
    landmark3: string;
    landmark4: string;
    dominatedArea: DominatedArea | null;
    otherExtraRemark: string;
    finalStatus: FinalStatus | null;
    holdReason: string;
    images: CapturedImage[];
    selfieImages: CapturedImage[];
}

export interface PositiveDsaReportData {
    addressLocatable: AddressLocatable | null;
    addressRating: AddressRating | null;
    officeStatus: OfficeStatusOffice | null;
    metPerson: string;
    designation: DesignationShiftedOffice | null;
    businessType: BusinessType | null;
    nameOfCompanyOwners: string;
    ownershipType: OwnershipTypeBusiness | null;
    addressStatus: AddressStatusBusiness | null;
    companyNatureOfBusiness: string;
    businessPeriod: string;
    officeApproxArea: number | null;
    staffStrength: number | null;
    staffSeen: number | null;
    activeClient: string;
    companyNamePlateStatus: SightStatus | null;
    nameOnBoard: string;
    tpcMetPerson1: TPCMetPerson | null;
    nameOfTpc1: string;
    tpcConfirmation1: TPCConfirmation | null;
    tpcMetPerson2: TPCMetPerson | null;
    nameOfTpc2: string;
    tpcConfirmation2: TPCConfirmation | null;
    locality: LocalityTypeResiCumOffice | null;
    addressStructure: string;
    addressStructureColor: string;
    doorColor: string;
    landmark1: string;
    landmark2: string;
    politicalConnection: PoliticalConnection | null;
    dominatedArea: DominatedArea | null;
    feedbackFromNeighbour: FeedbackFromNeighbour | null;
    otherObservation: string;
    finalStatus: FinalStatus | null;
    holdReason: string;
    images: CapturedImage[];
    selfieImages: CapturedImage[];
}

export interface ShiftedDsaReportData {
    addressLocatable: AddressLocatable | null;
    addressRating: AddressRating | null;
    officeStatus: OfficeStatusOffice | null;
    metPerson: string;
    designation: DesignationShiftedOffice | null;
    premisesStatus: PremisesStatusBusiness | null;
    currentCompanyName: string;
    currentCompanyPeriod: string;
    oldOfficeShiftedPeriod: string;
    approxArea: number | null;
    tpcMetPerson: TPCMetPerson | null;
    nameOfTpc: string;
    tpcConfirmation1: TPCConfirmation | null;
    tpcMetPerson2: TPCMetPerson | null;
    nameOfTpc2: string;
    tpcConfirmation2: TPCConfirmation | null;
    companyNamePlateStatus: SightStatus | null;
    nameOnBoard: string;
    locality: LocalityTypeResiCumOffice | null;
    addressStructure: string;
    addressStructureColor: string;
    doorColor: string;
    landmark1: string;
    landmark2: string;
    politicalConnection: PoliticalConnection | null;
    dominatedArea: DominatedArea | null;
    feedbackFromNeighbour: FeedbackFromNeighbour | null;
    otherObservation: string;
    finalStatus: FinalStatus | null;
    holdReason: string;
    images: CapturedImage[];
    selfieImages: CapturedImage[];
}

export interface NspDsaReportData {
    addressLocatable: AddressLocatable | null;
    addressRating: AddressRating | null;
    officeStatus: OfficeStatusOffice | null;
    businessExistance: BusinessExistence | null;
    applicantExistance: ApplicantExistence | null;
    metPerson: string;
    designation: DesignationShiftedOffice | null;
    premisesStatus: PremisesStatusBusiness | null;
    currentCompanyName: string;
    companyNamePlateStatus: SightStatus | null;
    nameOnBoard: string;
    tpcMetPerson1: TPCMetPerson | null;
    nameOfTpc1: string;
    tpcConfirmation1: TPCConfirmation | null;
    tpcMetPerson2: TPCMetPerson | null;
    nameOfTpc2: string;
    tpcConfirmation2: TPCConfirmation | null;
    locality: LocalityTypeResiCumOffice | null;
    addressStructure: string;
    addressStructureColor: string;
    doorColor: string;
    landmark1: string;
    landmark2: string;
    dominatedArea: DominatedArea | null;
    feedbackFromNeighbour: FeedbackFromNeighbour | null;
    otherObservation: string;
    finalStatus: FinalStatus | null;
    holdReason: string;
    images: CapturedImage[];
    selfieImages: CapturedImage[];
}

export interface EntryRestrictedDsaReportData {
    addressLocatable: AddressLocatable | null;
    addressRating: AddressRating | null;
    metPerson: MetPersonErt | null;
    nameOfMetPerson: string;
    metPersonConfirmation: TPCConfirmation | null;
    officeStatus: OfficeStatusErtDsa | null;
    locality: LocalityTypeResiCumOffice | null;
    addressStructure: string;
    applicantStayingFloor: string;
    addressStructureColor: string;
    landmark1: string;
    landmark2: string;
    politicalConnection: PoliticalConnection | null;
    dominatedArea: DominatedArea | null;
    feedbackFromNeighbour: FeedbackFromNeighbour | null;
    otherObservation: string;
    finalStatus: FinalStatus | null;
    holdReason: string;
    images: CapturedImage[];
    selfieImages: CapturedImage[];
}

export interface UntraceableDsaReportData {
    metPerson: string;
    callRemark: CallRemarkUntraceable | null;
    locality: LocalityTypeResiCumOffice | null;
    landmark1: string;
    landmark2: string;
    landmark3: string;
    landmark4: string;
    dominatedArea: DominatedArea | null;
    otherExtraRemark: string;
    finalStatus: FinalStatus | null;
    holdReason: string;
    images: CapturedImage[];
    selfieImages: CapturedImage[];
}

export interface PositivePropertyApfReportData {
    addressLocatable: AddressLocatable | null;
    addressRating: AddressRating | null;
    buildingStatus: BuildingStatusApf | null;
    flatStatus: FlatStatusApf | null;
    metPerson: string;
    relationship: RelationshipApf | null;
    propertyOwnerName: string;
    approxArea: number | null;
    tpcMetPerson1: TPCMetPerson | null;
    nameOfTpc1: string;
    tpcConfirmation1: TPCConfirmation | null;
    tpcMetPerson2: TPCMetPerson | null;
    nameOfTpc2: string;
    tpcConfirmation2: TPCConfirmation | null;
    locality: LocalityTypeResiCumOffice | null;
    addressStructure: string;
    addressExistAt: string;
    addressStructureColor: string;
    doorColor: string;
    doorNamePlateStatus: SightStatus | null;
    nameOnDoorPlate: string;
    societyNamePlateStatus: SightStatus | null;
    nameOnSocietyBoard: string;
    landmark1: string;
    landmark2: string;
    politicalConnection: PoliticalConnection | null;
    dominatedArea: DominatedArea | null;
    feedbackFromNeighbour: FeedbackFromNeighbour | null;
    otherObservation: string;
    finalStatus: FinalStatus | null;
    holdReason: string;
    // Construction Stop fields
    activityStopReason?: string;
    projectName?: string;
    projectStartedDate?: string;
    projectCompletionDate?: string;
    totalWing?: string;
    totalFlats?: string;
    totalBuildingsInProject?: string;
    projectCompletionPercent?: string;
    staffStrength?: string;
    staffSeen?: string;
    nameOnBoard?: string;
    images: CapturedImage[];
    selfieImages: CapturedImage[];
}

export interface NspPropertyApfReportData {
    addressLocatable: AddressLocatable | null;
    addressRating: AddressRating | null;
    buildingStatus: BuildingStatusApf | null;
    flatStatus: FlatStatusApf | null;
    metPerson: string;
    relationship: string;
    propertyOwnerName: string;
    tpcMetPerson1: TPCMetPerson | null;
    nameOfTpc1: string;
    tpcConfirmation1: TPCConfirmation | null;
    tpcMetPerson2: TPCMetPerson | null;
    nameOfTpc2: string;
    tpcConfirmation2: TPCConfirmation | null;
    locality: LocalityTypeResiCumOffice | null;
    addressStructure: string;
    addressStructureColor: string;
    doorColor: string;
    doorNamePlateStatus: SightStatus | null;
    nameOnDoorPlate: string;
    societyNamePlateStatus: SightStatus | null;
    nameOnSocietyBoard: string;
    landmark1: string;
    landmark2: string;
    politicalConnection: PoliticalConnection | null;
    dominatedArea: DominatedArea | null;
    feedbackFromNeighbour: FeedbackFromNeighbour | null;
    otherObservation: string;
    finalStatus: FinalStatus | null;
    holdReason: string;
    // Construction Stop fields
    activityStopReason?: string;
    projectName?: string;
    projectStartedDate?: string;
    projectCompletionDate?: string;
    totalWing?: string;
    totalFlats?: string;
    totalBuildingsInProject?: string;
    projectCompletionPercent?: string;
    staffStrength?: string;
    staffSeen?: string;
    nameOnBoard?: string;
    images: CapturedImage[];
    selfieImages: CapturedImage[];
}

export interface EntryRestrictedPropertyApfReportData {
    addressLocatable: AddressLocatable | null;
    addressRating: AddressRating | null;
    flatStatus: FlatStatusApf | null;
    metPerson: MetPersonErt | null;
    nameOfMetPerson: string;
    metPersonConfirmation: TPCConfirmation | null;
    propertyOwnerName: string;
    locality: LocalityTypeResiCumOffice | null;
    addressStructure: string;
    addressStructureColor: string;
    societyNamePlateStatus: SightStatus | null;
    nameOnSocietyBoard: string;
    landmark1: string;
    landmark2: string;
    buildingStatus: BuildingStatusApf | null;
    politicalConnection: PoliticalConnection | null;
    dominatedArea: DominatedArea | null;
    feedbackFromNeighbour: FeedbackFromNeighbour | null;
    otherObservation: string;
    finalStatus: FinalStatus | null;
    holdReason: string;
    images: CapturedImage[];
    selfieImages: CapturedImage[];
}

export interface UntraceablePropertyApfReportData {
    metPerson: string;
    callRemark: CallRemarkUntraceable | null;
    locality: LocalityTypeResiCumOffice | null;
    landmark1: string;
    landmark2: string;
    landmark3: string;
    landmark4: string;
    dominatedArea: DominatedArea | null;
    otherObservation: string;
    finalStatus: FinalStatus | null;
    holdReason: string;
    images: CapturedImage[];
    selfieImages: CapturedImage[];
}

export interface PositivePropertyIndividualReportData {
    addressLocatable: AddressLocatable | null;
    addressRating: AddressRating | null;
    buildingStatus: BuildingStatusApf | null;
    flatStatus: FlatStatusApf | null;
    metPerson: string;
    relationship: RelationshipApf | null;
    propertyOwnerName: string;
    approxArea: number | null;
    tpcMetPerson1: TPCMetPerson | null;
    nameOfTpc1: string;
    tpcConfirmation1: TPCConfirmation | null;
    tpcMetPerson2: TPCMetPerson | null;
    nameOfTpc2: string;
    tpcConfirmation2: TPCConfirmation | null;
    locality: LocalityTypeResiCumOffice | null;
    addressStructure: string;
    addressExistAt: string;
    addressStructureColor: string;
    doorColor: string;
    doorNamePlateStatus: SightStatus | null;
    nameOnDoorPlate: string;
    societyNamePlateStatus: SightStatus | null;
    nameOnSocietyBoard: string;
    landmark1: string;
    landmark2: string;
    politicalConnection: PoliticalConnection | null;
    dominatedArea: DominatedArea | null;
    feedbackFromNeighbour: FeedbackFromNeighbour | null;
    otherObservation: string;
    finalStatus: FinalStatus | null;
    holdReason: string;
    images: CapturedImage[];
    selfieImages: CapturedImage[];
}

export interface NspPropertyIndividualReportData {
    addressLocatable: AddressLocatable | null;
    addressRating: AddressRating | null;
    buildingStatus: BuildingStatusApf | null;
    flatStatus: FlatStatusApf | null;
    metPerson: string;
    relationship: string;
    propertyOwnerName: string;
    tpcMetPerson1: TPCMetPerson | null;
    nameOfTpc1: string;
    tpcConfirmation1: TPCConfirmation | null;
    tpcMetPerson2: TPCMetPerson | null;
    nameOfTpc2: string;
    tpcConfirmation2: TPCConfirmation | null;
    locality: LocalityTypeResiCumOffice | null;
    addressStructure: string;
    addressStructureColor: string;
    doorColor: string;
    doorNamePlateStatus: SightStatus | null;
    nameOnDoorPlate: string;
    societyNamePlateStatus: SightStatus | null;
    nameOnSocietyBoard: string;
    landmark1: string;
    landmark2: string;
    politicalConnection: PoliticalConnection | null;
    dominatedArea: DominatedArea | null;
    feedbackFromNeighbour: FeedbackFromNeighbour | null;
    otherObservation: string;
    finalStatus: FinalStatus | null;
    holdReason: string;
    images: CapturedImage[];
    selfieImages: CapturedImage[];
}

export interface EntryRestrictedPropertyIndividualReportData {
    addressLocatable: AddressLocatable | null;
    addressRating: AddressRating | null;
    flatStatus: FlatStatusApf | null;
    metPerson: MetPersonErt | null;
    nameOfMetPerson: string;
    metPersonConfirmation: TPCConfirmation | null;
    propertyOwnerName: string;
    locality: LocalityTypeResiCumOffice | null;
    addressStructure: string;
    addressStructureColor: string;
    societyNamePlateStatus: SightStatus | null;
    nameOnSocietyBoard: string;
    landmark1: string;
    landmark2: string;
    buildingStatus: BuildingStatusApf | null;
    politicalConnection: PoliticalConnection | null;
    dominatedArea: DominatedArea | null;
    feedbackFromNeighbour: FeedbackFromNeighbour | null;
    otherObservation: string;
    finalStatus: FinalStatus | null;
    holdReason: string;
    images: CapturedImage[];
    selfieImages: CapturedImage[];
}

export interface UntraceablePropertyIndividualReportData {
    metPerson: string;
    callRemark: CallRemarkUntraceable | null;
    locality: LocalityTypeResiCumOffice | null;
    landmark1: string;
    landmark2: string;
    landmark3: string;
    landmark4: string;
    dominatedArea: DominatedArea | null;
    otherObservation: string;
    finalStatus: FinalStatus | null;
    holdReason: string;
    images: CapturedImage[];
    selfieImages: CapturedImage[];
}


export interface Case {
  id: string;
  title: string;
  description: string;
  customer: {
    name: string;
    contact: string;
  };
  status: CaseStatus;
  isSaved: boolean;
  createdAt: string; // Case Assignment Date/Time
  updatedAt: string; // Last Update Date/Time
  inProgressAt?: string; // In Progress Date/Time
  savedAt?: string; // Save Date/Time
  completedAt?: string; // Completion Date/Time
  submissionStatus?: 'pending' | 'submitting' | 'success' | 'failed'; // Submission status for completed cases
  submissionError?: string; // Error message if submission failed
  lastSubmissionAttempt?: string; // Timestamp of last submission attempt

  // Enhanced fields for 13 required case fields from backend
  // Field 1: Customer Name (already available as customer.name)
  customerName?: string; // Direct field from backend

  // Field 2: Case ID (already available as id)
  caseId?: number; // Backend auto-increment case ID

  // Field 3: Client
  clientId?: number; // Client ID from backend
  clientName?: string; // Client name from backend JOIN
  clientCode?: string; // Client code from backend JOIN
  client?: {
    id: number; // Fixed: Use number to match backend
    name: string;
    code: string;
  };

  // Field 4: Product
  productId?: number; // Product ID from backend
  productName?: string; // Product name from backend JOIN
  productCode?: string; // Product code from backend JOIN
  product?: string | {
    id: number; // Fixed: Use number to match backend
    name: string;
    code: string;
  }; // Legacy field for backward compatibility

  // Field 5: Verification Type (already available)
  verificationType: VerificationType;
  verificationTypeId?: number; // Verification type ID from backend
  verificationTypeName?: string; // Verification type name from backend JOIN
  verificationTypeCode?: string; // Verification type code from backend JOIN

  // Field 6: Applicant Type (already available as applicantStatus)
  applicantType?: string; // Direct field from backend
  applicantStatus?: string; // Legacy field for backward compatibility

  // Field 7: Created By Backend User
  createdByBackendUser?: string; // Backend user ID
  createdByBackendUserName?: string; // Backend user name from JOIN
  createdByBackendUserEmail?: string; // Backend user email from JOIN

  // Field 8: Backend Contact Number (already available as systemContactNumber)
  backendContactNumber?: string; // Direct field from backend
  systemContactNumber?: string; // Legacy field for backward compatibility

  // Field 9: Assign to Field User
  assignedTo?: string; // Assigned user ID
  assignedToName?: string; // Assigned user name from JOIN
  assignedToFieldUser?: string; // Assigned field user name from backend
  assignedToEmail?: string; // Assigned user email from JOIN

  // Field 10: Priority (already available)
  priority?: number; // User-defined priority for In Progress cases (1, 2, 3, etc.)

  // Field 11: Trigger (already available)
  trigger?: string; // Direct field from backend

  // Field 12: Customer Calling Code (already available)
  customerCallingCode?: string; // Direct field from backend

  // Field 13: Address (already available as visitAddress)
  address?: string; // Direct field from backend
  addressStreet?: string; // Address street from backend
  visitAddress?: string; // Legacy field for backward compatibility

  // Legacy fields maintained for backward compatibility
  bankName?: string;
  verificationOutcome: VerificationOutcome | null;
  order?: number;
  notes?: string;
  attachments?: Attachment[]; // Case attachments (PDFs and images, max 10 attachments, 10MB each)
  residenceReport?: ResidenceReportData;
  shiftedResidenceReport?: ShiftedResidenceReportData;
  nspResidenceReport?: NspResidenceReportData;
  entryRestrictedResidenceReport?: EntryRestrictedResidenceReportData;
  untraceableResidenceReport?: UntraceableResidenceReportData;
  resiCumOfficeReport?: ResiCumOfficeReportData;
  shiftedResiCumOfficeReport?: ShiftedResiCumOfficeReportData;
  nspResiCumOfficeReport?: NspResiCumOfficeReportData;
  entryRestrictedResiCumOfficeReport?: EntryRestrictedResiCumOfficeReportData;
  untraceableResiCumOfficeReport?: UntraceableResiCumOfficeReportData;
  positiveOfficeReport?: PositiveOfficeReportData;
  shiftedOfficeReport?: ShiftedOfficeReportData;
  nspOfficeReport?: NspOfficeReportData;
  entryRestrictedOfficeReport?: EntryRestrictedOfficeReportData;
  untraceableOfficeReport?: UntraceableOfficeReportData;
  positiveBusinessReport?: PositiveBusinessReportData;
  shiftedBusinessReport?: ShiftedBusinessReportData;
  nspBusinessReport?: NspBusinessReportData;
  entryRestrictedBusinessReport?: EntryRestrictedBusinessReportData;
  untraceableBusinessReport?: UntraceableBusinessReportData;
  positiveBuilderReport?: PositiveBuilderReportData;
  shiftedBuilderReport?: ShiftedBuilderReportData;
  nspBuilderReport?: NspBuilderReportData;
  entryRestrictedBuilderReport?: EntryRestrictedBuilderReportData;
  untraceableBuilderReport?: UntraceableBuilderReportData;
  positiveNocReport?: PositiveNocReportData;
  shiftedNocReport?: ShiftedNocReportData;
  nspNocReport?: NspNocReportData;
  entryRestrictedNocReport?: EntryRestrictedNocReportData;
  untraceableNocReport?: UntraceableNocReportData;
  positiveDsaReport?: PositiveDsaReportData;
  shiftedDsaReport?: ShiftedDsaReportData;
  nspDsaReport?: NspDsaReportData;
  entryRestrictedDsaReport?: EntryRestrictedDsaReportData;
  untraceableDsaReport?: UntraceableDsaReportData;
  positivePropertyApfReport?: PositivePropertyApfReportData;
  nspPropertyApfReport?: NspPropertyApfReportData;
  entryRestrictedPropertyApfReport?: EntryRestrictedPropertyApfReportData;
  untraceablePropertyApfReport?: UntraceablePropertyApfReportData;
  positivePropertyIndividualReport?: PositivePropertyIndividualReportData;
  nspPropertyIndividualReport?: NspPropertyIndividualReportData;
  entryRestrictedPropertyIndividualReport?: EntryRestrictedPropertyIndividualReportData;
  untraceablePropertyIndividualReport?: UntraceablePropertyIndividualReportData;
}

export interface User {
  id: string;
  name: string;
  username: string;
  email?: string;
  role?: string;
  profilePhotoUrl?: string;
  profilePhoto?: string;
  employeeId?: string;
  designation?: string;
  department?: string;
  phone?: string;
}