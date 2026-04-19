# Test Plan — Restful Booker API

---

## Table of Contents

1. [Objective](#objective)
2. [Scope](#scope)
3. [Inclusions](#inclusions)
4. [Test Environments](#test-environments)
5. [Defect Reporting Procedure](#defect-reporting-procedure)
6. [Test Strategy](#test-strategy)
7. [Test Schedule](#test-schedule)
8. [Test Deliverables](#test-deliverables)
9. [Entry and Exit Criteria](#entry-and-exit-criteria)
10. [Tools](#tools)
11. [Risks and Mitigations](#risks-and-mitigations)
12. [Approvals](#approvals)

---

## Objective

The goal of this test plan is to ensure the quality, functionality, and reliability of the Restful Booker API hosted at [https://restful-booker.herokuapp.com](https://restful-booker.herokuapp.com).

The API is designed to handle booking requests for a fictional hotel booking system.

---

## Scope

### 1. Functional Testing
- Verify the correctness and functionality of all API endpoints as per the API documentation.
- Test various scenarios for booking creation, modification, and cancellation.
- Validate user authentication and authorization mechanisms for protected endpoints.

### 2. Data Validation Testing
- Ensure that the API correctly validates input data, rejecting invalid requests.
- Test boundary values for input fields to check for any unexpected behavior.
- Validate the accuracy of data returned in responses.

### 3. Error Handling Testing
- Verify that appropriate error codes and messages are returned for invalid requests.
- Check error responses for sensitive information disclosure.
- Validate the API's ability to handle unexpected errors gracefully.

### 4. Performance Testing
- Assess the API's response time under normal and peak loads to identify potential bottlenecks.
- Measure the API's throughput and scalability to handle concurrent requests.

### 5. Security Testing
- Conduct security assessments to identify vulnerabilities such as SQL injection, XSS, etc.
- Validate the API's compliance with secure data transmission practices (e.g., HTTPS).
- Check for proper access controls to prevent unauthorized access to sensitive resources.

### 6. Integration Testing
- Verify interactions between different API endpoints and services.
- Test data consistency across related endpoints.

### 7. Compatibility Testing
- Test the API on different platforms, browsers, and devices to ensure cross-compatibility.

### 8. Documentation Review
- Assess the clarity, completeness, and accuracy of the API documentation.
- Verify that the API documentation is in sync with the actual API behavior.

### 9. Load Testing
- Evaluate the API's behavior under high concurrent user loads to ensure stability.

### 10. Regression Testing
- Conduct regression testing after bug fixes or updates to ensure existing functionality remains intact.

### 11. Edge Case Testing
- Test extreme and boundary scenarios to identify potential issues.

### 12. Concurrency Testing
- Assess the API's behavior when multiple users attempt to access and modify bookings simultaneously.

### 13. Ad Hoc Testing
- Perform exploratory testing to identify any hidden defects or usability issues.

### 14. Usability Testing
- Evaluate the API's user-friendliness and ease of use from a developer's perspective.

### 15. CI/CD Testing
- Validate the API's behavior within the CI/CD pipeline to ensure smooth deployments.

### 16. Performance Monitoring
- Implement monitoring to track API performance in real-time.

### 17. Backup and Recovery Testing
- Validate data backup and recovery procedures to ensure data integrity.

### 18. Internationalization Testing
- Test the API's behavior with different language settings.

### 19. Rate Limiting Testing
- Check the API's adherence to rate-limiting rules to prevent abuse.

### 20. Third-Party Integration Testing
- Validate any third-party integrations for smooth functioning.

> **Note:** The scope may evolve during the testing process based on feedback, changing requirements, or discoveries. It should be reviewed and adjusted accordingly throughout the testing phase.

---

## Inclusions

### Create (POST) Operations
- Test the API's ability to create new bookings using valid input data.
- Verify that appropriate error responses are returned for invalid or missing data.
- Validate that newly created bookings are stored correctly in the system.

### Read (GET) Operations
- Test the API's ability to retrieve booking information by various criteria (e.g., booking ID, date range, guest name).
- Verify that the API returns the correct data in response to read requests.
- Test for correct handling of non-existent or invalid booking IDs.

### Update (PUT) Operations
- Test the API's ability to update existing bookings with valid data.
- Verify that the API rejects invalid update requests with appropriate error responses.
- Validate that the booking data is correctly modified in the system after updates.

### Delete (DELETE) Operations
- Test the API's ability to delete bookings by providing valid booking IDs.
- Verify that the API returns appropriate responses after successful deletion.
- Validate that the deleted bookings are removed from the system.

### Boundary Testing
- Test the API with minimum and maximum allowed values for input fields.
- Validate the behavior of the API with values close to the boundaries.

### Concurrency Testing
- Test the API's behavior when multiple users try to perform CRUD operations simultaneously.
- Verify data consistency and handling of concurrent modifications.

### Data Validation
- Test the API's response to various data validation scenarios (e.g., invalid characters, data types, mandatory fields).
- Verify that the API handles validation errors appropriately.

### Authentication and Authorization
- Test CRUD operations for both authenticated and unauthenticated users.
- Verify that only authorized users can perform certain CRUD operations.

### Error Handling
- Test the API's response when invalid or malformed requests are made for CRUD operations.
- Validate that appropriate error codes and messages are returned.

### Security Testing
- Test for security vulnerabilities during CRUD operations (e.g., SQL injection, XSS).
- Verify that sensitive data is not exposed in responses.

### Performance Testing
- Evaluate the API's response time for CRUD operations under normal and peak loads.
- Measure the throughput and scalability of the API.

### Integration Testing
- Verify the interaction and data consistency between CRUD operations and other API components.

### Regression Testing
- Perform regression tests after bug fixes or updates to ensure existing CRUD functionalities remain intact.

### Documentation Review
- Assess the accuracy of API documentation related to CRUD operations.

### Load Testing
- Evaluate the API's behavior and performance during CRUD operations under high concurrent user loads.

### Compatibility Testing
- Test the API's CRUD operations on different platforms, browsers, and devices.

### Usability Testing
- Evaluate the ease of using CRUD functionalities from a developer's perspective.

### CI/CD Testing
- Validate the CRUD operations within the CI/CD pipeline to ensure smooth deployments.

### Rate Limiting Testing
- Check the API's adherence to rate-limiting rules for CRUD operations to prevent abuse.

### Backup and Recovery Testing
- Validate data backup and recovery procedures for CRUD-related data.

---

## Test Environments

| Name     | Environment URL                                                       |
|----------|-----------------------------------------------------------------------|
| QA       | https://restful-booker.herokuapp.com/apidoc/index.html               |
| Pre Prod | https://restful-booker.herokuapp.com/apidoc/index.html               |

### Supported Platforms
- Windows 10 — Chrome, Firefox, and Edge
- macOS — Safari
- Android Mobile OS — Chrome
- iPhone Mobile OS — Safari

### Environment Considerations
- Operating systems and versions used for testing.
- Browsers and versions to be tested.
- Device types and screen sizes (desktop, laptop, tablet, smartphone).
- Network connectivity and bandwidth (Wi-Fi, cellular, wired).
- Hardware and software requirements for running test cases.
- Security protocols and authentication methods (passwords, tokens, certificates).
- Access permissions and roles of team members (testers, developers, stakeholders).

---

## Defect Reporting Procedure

Defects will be tracked and reported using **JIRA**.

| Defect Process  | POC     |
|-----------------|---------|
| New Frontend    | Devesh  |
| Backend         | Sonal   |
| Dev Ops         | Prajeeth|

### Process Overview
- Criteria for identifying a defect: deviation from requirements, UX issues, or technical errors.
- Defects are reported using a designated template with detailed reproduction steps, screenshots, and logs.
- Defects are triaged and prioritized by severity and priority level, and assigned to the appropriate team member.
- Communication channels and frequencies are established for updating stakeholders on defect status.
- Metrics tracked: number of defects found, time to resolve, and percentage of defects fixed.

---

## Test Strategy

### Step 1 — Test Case Development

Test scenarios and cases will be created using the following design techniques:
- Equivalence Class Partition
- Boundary Value Analysis
- Decision Table Testing
- State Transition Testing
- Use Case Testing

Additional techniques:
- Error Guessing
- Exploratory Testing

Test cases will be prioritized accordingly.

### Step 2 — Testing Procedure

1. **Smoke Testing** is conducted first to verify that key functionalities are working.
2. If Smoke Testing **fails**, the build is rejected and testing waits for a stable build.
3. Once a stable build passes Smoke Testing, **in-depth testing** begins using prepared test cases.
4. Multiple testers execute cases across multiple supported environments simultaneously.
5. Bugs are reported in JIRA, and a defect status email is sent to dev management at end of day.

**Types of Testing Performed:**
- Smoke Testing and Sanity Testing
- Regression Testing and Retesting
- Usability Testing, Functionality & UI Testing

Test cycles repeat until a quality product is achieved.

### Step 3 — Best Practices

- **Context Driven Testing** — Testing is performed as per the context of the application.
- **Shift Left Testing** — Testing begins from the early stages of development.
- **Exploratory Testing** — Beyond scripted test cases, exploratory testing is performed using team expertise.
- **End-to-End Flow Testing** — End-to-end scenarios involving multiple functionalities are tested to simulate real user flows.

---

## Test Schedule

| Task                          | Dates |
|-------------------------------|-------|
| Creating Test Plan            |       |
| Test Case Creation            |       |
| Test Case Execution           |       |
| Summary Reports Submission    |       |

> **Duration:** 2 Sprints to test the application.

---

## Test Deliverables

- Test Plan
- Test Scenarios
- Test Cases
- Test Case Reports
- Defect Reports
- Test Summary Reports

---

## Entry and Exit Criteria

### Requirement Analysis
**Entry Criteria:**
- Testing team receives the Requirements Documents or project details.

**Exit Criteria:**
- All requirements are explored and understood by the testing team.
- All doubts and queries are cleared.

### Test Execution
**Entry Criteria:**
- Test Scenarios and Test Cases are signed off by the client.
- Application is ready for testing.

**Exit Criteria:**
- Test Case Reports and Defect Reports are ready.

### Test Closure
**Entry Criteria:**
- Test Case Reports and Defect Reports are ready.

**Exit Criteria:**
- Test Summary Reports are submitted.

---

## Tools

| Tool                    | Purpose                     |
|-------------------------|-----------------------------|
| JIRA                    | Bug Tracking                |
| Mind Map Tool           | Test Planning & Visualization|
| Snipping/Screenshot Tool| Defect Evidence Capture     |
| Word & Excel Documents  | Documentation               |

---

## Risks and Mitigations

| Risk                          | Mitigation                                              |
|-------------------------------|---------------------------------------------------------|
| Non-availability of a resource | Backup resource planning                               |
| Build URL is not working      | Resources will work on other tasks in the meantime     |
| Less time for testing         | Dynamically ramp up resources based on client needs    |

---

## Approvals

The following documents will be submitted for client approval before proceeding to the next phase:

- Test Plan
- Test Scenarios
- Test Cases
- Reports

> Testing will only continue to the next phase once all required approvals are obtained.
