CREATE TABLE IF NOT EXISTS Users (
  UserId varchar(40) PRIMARY KEY,
  Username varchar(50) NOT NULL UNIQUE,
  Phone varchar(20) NOT NULL UNIQUE,
  PasswordHash varchar(512) NOT NULL,
  DisplayName varchar(120) NOT NULL,
  RoleKey varchar(20) NOT NULL,
  IsActive boolean NOT NULL DEFAULT TRUE,
  CreatedAt timestamp NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS Customers (
  CustomerId varchar(40) PRIMARY KEY,
  Name varchar(150) NOT NULL,
  Phone varchar(20),
  Email varchar(120),
  Note varchar(500),
  CreatedAt timestamp NOT NULL DEFAULT NOW(),
  UpdatedAt timestamp NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS Products (
  ProductId varchar(40) PRIMARY KEY,
  Name varchar(150) NOT NULL,
  Code varchar(50),
  DefaultPrice numeric(18,2) NOT NULL DEFAULT 0,
  Note varchar(500),
  CreatedAt timestamp NOT NULL DEFAULT NOW(),
  UpdatedAt timestamp NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS Visits (
  VisitId varchar(40) PRIMARY KEY,
  CustomerId varchar(40) NOT NULL,
  ProductId varchar(40) NOT NULL,
  ReferrerUserId varchar(40),
  VisitDate date NOT NULL,
  Revenue numeric(18,2) NOT NULL,
  OccurrenceInMonth integer NOT NULL,
  VoucherRate numeric(10,4) NOT NULL,
  VoucherAmount numeric(18,2) NOT NULL,
  Note varchar(500),
  CreatedByUserId varchar(40) NOT NULL,
  CreatedAt timestamp NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ReferralCommissions (
  ReferralId varchar(40) PRIMARY KEY,
  VisitId varchar(40) NOT NULL,
  ReferrerUserId varchar(40) NOT NULL,
  CustomerId varchar(40) NOT NULL,
  ProductId varchar(40) NOT NULL,
  VisitDate date NOT NULL,
  Revenue numeric(18,2) NOT NULL,
  OccurrenceInMonth integer NOT NULL,
  CommissionRate numeric(10,4) NOT NULL,
  CommissionAmount numeric(18,2) NOT NULL,
  CreatedAt timestamp NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS MemberPointEvents (
  PointEventId varchar(40) PRIMARY KEY,
  MemberUserId varchar(40) NOT NULL,
  Points integer NOT NULL,
  ReasonDetail varchar(500) NOT NULL,
  IsPublic boolean NOT NULL DEFAULT TRUE,
  AwardedByUserId varchar(40) NOT NULL,
  AwardedAt timestamp NOT NULL,
  MonthKey char(7) NOT NULL
);

CREATE TABLE IF NOT EXISTS OtpRequests (
  OtpRequestId varchar(40) PRIMARY KEY,
  Phone varchar(20) NOT NULL,
  Purpose varchar(50) NOT NULL,
  Code varchar(12) NOT NULL,
  ExpiresAt timestamp NOT NULL,
  VerifiedAt timestamp,
  CreatedAt timestamp NOT NULL DEFAULT NOW(),
  Status varchar(20) NOT NULL,
  AttemptCount integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS OtpProviderSettings (
  ConfigId varchar(40) PRIMARY KEY,
  Endpoint text NOT NULL DEFAULT '',
  ApiKey varchar(300) NOT NULL DEFAULT '',
  Sender varchar(120) NOT NULL DEFAULT '',
  Template text NOT NULL DEFAULT '',
  HttpMethod varchar(10) NOT NULL DEFAULT 'GET',
  ParamPairsJson text NOT NULL DEFAULT '[]',
  IsDevMode boolean NOT NULL DEFAULT TRUE,
  UpdatedAt timestamp NOT NULL DEFAULT NOW(),
  UpdatedByUserId varchar(40)
);

CREATE INDEX IF NOT EXISTS IX_Visits_CustomerId_VisitDate ON Visits(CustomerId, VisitDate, CreatedAt);
CREATE INDEX IF NOT EXISTS IX_ReferralCommissions_VisitId ON ReferralCommissions(VisitId);
CREATE INDEX IF NOT EXISTS IX_MemberPointEvents_MonthKey ON MemberPointEvents(MonthKey, AwardedAt);
CREATE INDEX IF NOT EXISTS IX_OtpRequests_Phone_Purpose_CreatedAt ON OtpRequests(Phone, Purpose, CreatedAt);
