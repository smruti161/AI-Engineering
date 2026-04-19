# Bug Report: Login Page Sign-In Button Not Functional

## Bug ID
LOGIN_BUG_001

## Severity
High

## Status
Open

## Date Reported
April 8, 2026

---

## Summary
When a user enters username and password credentials and clicks the login button, nothing happens. The page does not refresh or redirect to the dashboard.

## Steps to Reproduce
1. Navigate to the VWO login page (app.vwo.com/#/login)
2. Enter valid email ID in the "Enter email ID" field
3. Enter valid password in the "Enter password" field
4. Click the "Sign in" button
5. **Expected Result:** Page should refresh and redirect to the dashboard
6. **Actual Result:** Nothing happens - page remains on login screen

## Environment
- **Application:** VWO (Visual Website Optimizer)
- **URL:** app.vwo.com/#/login
- **Browser:** Chrome (based on screenshots)
- **OS:** Windows

## Affected UI Elements
- Sign In Button (Primary action button)

## Expected Behavior
After entering valid credentials and clicking the "Sign in" button:
- Authentication request should be sent to backend
- User should be redirected to dashboard upon successful authentication
- Error message should display if authentication fails

## Actual Behavior
- No response to button click
- No page redirect
- No error message displayed
- No network activity (if checked in browser console)

## Possible Root Causes
1. JavaScript click event handler not attached to the Sign In button
2. Event listener may be missing or not properly initialized
3. Network request may be blocked or misconfigured
4. Form submission may be prevented without proper redirection logic
5. API endpoint may not be responding

## Screenshots/Attachments
- login_error.png (error state visible)
- login_page.png (empty login form state)

## Next Steps
1. Inspect browser console for JavaScript errors
2. Check network tab for failed API calls
3. Review Sign In button click handler implementation
4. Verify API endpoint configuration
5. Test with browser DevTools to debug event listeners

---

## Notes
- Similar error message appears in first screenshot: "Your email, password, IP address or location did not match"
- This suggests authentication validation is working in some cases, but sign-in flow is broken

