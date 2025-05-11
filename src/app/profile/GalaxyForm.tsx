import React, { useState, useEffect, useCallback, useRef } from 'react'; // Added useRef
import { Play, Square, RefreshCw, LogOut, CheckCircle, X } from 'lucide-react';
import styles from '../styles/GalaxyControl.module.css';
import { useRouter } from 'next/navigation';

type FormData = {
  RC: string;
  startAttackTime: string;
  stopAttackTime: string;
  attackIntervalTime: string;
  startDefenceTime: string;
  stopDefenceTime: string;
  defenceIntervalTime: string;
  PlanetName: string;
  Rival: string;
};

type ButtonState = {
  loading: boolean;
  active: boolean;
  text: string;
};

type ButtonStates = {
  start: ButtonState;
  stop: ButtonState;
  update: ButtonState;
};

type ActionType = keyof ButtonStates;

const initialButtonStates: ButtonStates = {
  start: { loading: false, active: false, text: 'Start' },
  stop: { loading: false, active: false, text: 'Stop' },
  update: { loading: false, active: false, text: 'Update' },
};

const GalaxyForm: React.FC = () => {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [activeTab, setActiveTab] = useState<number>(1);
  const [username, setUsername] = useState<string | null>(null); 
  const [displayedUsername, setDisplayedUsername] = useState<string | null>(null);
  const [showDeployPopup, setShowDeployPopup] = useState<boolean>(false); 
  const [isDeploying, setIsDeploying] = useState<boolean>(false);
  const [isUndeploying, setIsUndeploying] = useState<boolean>(false);
  const [deploymentStatus, setDeploymentStatus] = useState<string>('Checking deployment status...'); 
  const [isDeployed, setIsDeployed] = useState<boolean>(false);
  const [isPollingStatus, setIsPollingStatus] = useState<boolean>(false);
  const [redeployMode, setRedeployMode] = useState<boolean>(false);
  const [showThankYouMessage, setShowThankYouMessage] = useState<boolean>(false);
  const [activationProgressTimerId, setActivationProgressTimerId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activationProgressPercent, setActivationProgressPercent] = useState<number>(0);
  const [autoUndeployMessage, setAutoUndeployMessage] = useState<string | null>(null);
  const [showAutoUndeployPopup, setShowAutoUndeployPopup] = useState<boolean>(false);
  const [tokenExpiryDisplay, setTokenExpiryDisplay] = useState<string | null>(null);

  // Refs for managing timer IDs
  const findRunIdTimerRef = useRef<number | null>(null);
  const statusPollTimerRef = useRef<number | null>(null);
  const cancelPollTimerRef = useRef<number | null>(null);

interface LatestUserRunResponse { // Adjusted to match API response
  runId: number;
  status: string | null;
  conclusion: string | null;
  jobName: string; // Essential for logic
  // createdAt: string; // No longer sent by API
  // htmlUrl: string; // No longer sent by API
}

const getApiAuthHeaders = (): Record<string, string> => {
  // HTTP-only cookies are sent automatically by the browser.
  // Backend API routes protected by middleware or using validateSession (from lib/auth)
  // will have access to session details via cookies.
  // No need to manually set Authorization, X-User-ID, X-Session-ID from sessionStorage.
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  // console.log('getApiAuthHeaders: Relying on HttpOnly cookies for session auth.');
  return headers;
};

  const clearAllPollingTimers = useCallback(() => {
    if (findRunIdTimerRef.current !== null) {
      window.clearInterval(findRunIdTimerRef.current);
      findRunIdTimerRef.current = null;
    }
    if (statusPollTimerRef.current !== null) {
      window.clearInterval(statusPollTimerRef.current);
      statusPollTimerRef.current = null;
    }
    if (cancelPollTimerRef.current !== null) {
      window.clearInterval(cancelPollTimerRef.current);
      cancelPollTimerRef.current = null;
    }
    // activationProgressTimerId is state, cleared where it's set/used or here if needed
    // For now, focusing on the polling timers causing potential freezes.
    // console.log('Polling timers cleared via refs.');
  }, []); // No direct state dependencies for these refs, but activationProgressTimerId is state
  
  const formNames = {
    1: 'Kick 1',
    2: 'Kick 2',
    3: 'Kick 3',
    4: 'Kick 4',
    5: 'Kick 5'
  };
  
  const handleLogout = async () => {
    if (activationProgressTimerId !== null) {
      window.clearInterval(activationProgressTimerId);
      setActivationProgressTimerId(null);
    }
    if (isDeployed) {
      setShowDeployPopup(true); 
      try {
        await handleUndeploy(); 
      } catch (err) {
        console.error("Error during undeploy on logout:", err);
        // Proceed with logout even if undeploy fails
      }
    }
    
    try {
      // Call the backend signout API which will clear HttpOnly cookies
      const response = await fetch('/api/auth/signout', { 
        method: 'POST',
        headers: getApiAuthHeaders(), // Send content-type, cookies are auto-sent
      }); 
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Logout API call failed:', errorData.message || response.statusText);
        // Still attempt to clear client-side and redirect
      }
    } catch (apiError) {
      console.error('Error calling logout API:', apiError);
      // Still attempt to clear client-side and redirect
    }

    // Clear any client-side storage (e.g., username if stored for display)
    sessionStorage.removeItem('username'); 
    // Potentially clear other session-related items if any were stored.
    // sessionStorage.clear(); // Use this if you want to clear everything from sessionStorage

    router.push('/signin');
  };

  const checkInitialDeploymentStatus = async (logicalUsernameToCheck: string) => {
    setDeploymentStatus('Checking deployment status...');
    try {
      const authHeaders = getApiAuthHeaders(); // Primarily for Content-Type now
      // The check for authHeaders['Authorization'] is removed as middleware handles auth.
      // If this point is reached, middleware should have validated the session cookies.

      console.log(`Fetching latest run status for job name based on: ${logicalUsernameToCheck} via /api/git/latest-user-run`);
      const response = await fetch(`/api/git/latest-user-run?logicalUsername=${logicalUsernameToCheck}`, { headers: authHeaders });

      if (response.ok) {
        const data = await response.json() as LatestUserRunResponse;
        const isActiveStatus = data.status === 'in_progress' || data.status === 'queued';

        if (isActiveStatus) {
          // console.log for htmlUrl and createdAt can be removed or kept if useful for server-side debugging via client logs
          console.log(`Active deployment found (Run ID: ${data.runId}, Job: "${data.jobName}", Status: ${data.status}).`);
          setIsDeployed(true);
          setShowDeployPopup(false);
          setDeploymentStatus(`Active deployment detected (Run ID: ${data.runId}, Status: ${data.status}).`);
        } else {
          console.log(`Latest run found (Run ID: ${data.runId}, Job: "${data.jobName}", Status: ${data.status}, Conclusion: ${data.conclusion}), but it's not currently active.`);
          setIsDeployed(false);
          setShowDeployPopup(true);
          // Display message doesn't rely on createdAt or htmlUrl
          setDeploymentStatus(`Deployment not active. Latest run: ${data.status} (Conclusion: ${data.conclusion || 'N/A'}). Redeploy if needed.`);
        }
      } else if (response.status === 404) {
        console.log(`No run found for job name based on ${logicalUsernameToCheck}.`);
        setIsDeployed(false);
        setShowDeployPopup(true);
        setDeploymentStatus('No deployment found for your user. Deployment is required.');
      } else {
        const errorData = await response.json();
        console.error("Failed to check initial deployment status:", errorData.message || response.statusText);
        setDeploymentStatus(`Error checking status: ${errorData.message || 'Please try again.'}`);
        setIsDeployed(false);
        setShowDeployPopup(true);
      }
    } catch (error) {
      console.error("Error calling /api/git/latest-user-run:", error);
      setDeploymentStatus('Error connecting for status check. Please try again.');
      setIsDeployed(false);
      setShowDeployPopup(true);
    }
  };

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) {
      return;
    }

    const fetchSessionDetails = async () => {
      try {
        const response = await fetch('/api/auth/session-details');
        if (response.ok) {
          const details = await response.json();
          if (details.username) {
            setDisplayedUsername(details.username);
            const suffix = '7890'; // Assuming this suffix logic is still desired
            const suffixedUsername = `${details.username}${suffix}`;
            setUsername(suffixedUsername);
            
            setShowDeployPopup(true);
            setDeploymentStatus('Checking deployment status...');
            checkInitialDeploymentStatus(suffixedUsername); // Pass suffixed username
          } else {
            // Handle case where username might not be in session details but session is valid
             setDeploymentStatus('Please sign in to manage deployments.');
             setIsDeployed(false);
             setShowDeployPopup(true);
          }

          if (details.tokenExpiresAt) {
            const expiryDate = new Date(details.tokenExpiresAt);
            const today = new Date();
            
            // Normalize dates to midnight to compare day counts accurately
            const expiryDateMidnight = new Date(expiryDate.getFullYear(), expiryDate.getMonth(), expiryDate.getDate());
            const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

            const day = String(expiryDate.getDate()).padStart(2, '0');
            const month = String(expiryDate.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
            const year = expiryDate.getFullYear();
            const formattedDate = `${day}-${month}-${year}`;

            let daysRemainingString = "";
            if (expiryDateMidnight < todayMidnight) {
              daysRemainingString = "(Expired)";
            } else {
              const diffTime = Math.abs(expiryDateMidnight.getTime() - todayMidnight.getTime());
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              daysRemainingString = `(${diffDays} day${diffDays !== 1 ? 's' : ''} remaining)`;
            }
            setTokenExpiryDisplay(`${formattedDate} ${daysRemainingString}`);
          }
        } else {
          // Not authenticated or error fetching session
          console.error('Failed to fetch session details:', response.status);
          setDeploymentStatus('Session details unavailable. Please sign in.');
          setIsDeployed(false);
          setShowDeployPopup(true);
          // Optionally redirect to signin if session is strictly required
          // router.push('/signin'); 
        }
      } catch (error) {
        console.error('Error fetching session details:', error);
        setDeploymentStatus('Error fetching session. Please try signing in again.');
        setIsDeployed(false);
        setShowDeployPopup(true);
      }
    };

    fetchSessionDetails();

    // Original logic for sessionStorage username (can be fallback or removed if API is primary)
    // const storedUsername = sessionStorage.getItem('username'); 
    // if (storedUsername) {
    //   setDisplayedUsername(storedUsername);
    //   const suffix = '7890';
    //   const suffixedUsername = `${storedUsername}${suffix}`; 
    //   setUsername(suffixedUsername); 
      
    //   setShowDeployPopup(true);
    //   setDeploymentStatus('Checking deployment status...'); 
    //   checkInitialDeploymentStatus(suffixedUsername); 
    // } else {
    //   setDeploymentStatus('Please sign in to manage deployments.');
    //   setIsDeployed(false);
    //   setShowDeployPopup(true);
      // router.push('/signin'); // Consider if redirect is needed if no username
    // }

    // REMOVED DUPLICATE handleBeforeUnload HERE - the correct one is in the other useEffect

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // Check isDeployed state at the moment of unload
      // Note: isDeployed might not be the most up-to-date from state here due to closure.
      // It's better to get it from sessionStorage or a ref if critical,
      // but for sendBeacon, we fire it if there's a chance it's deployed.
      // The backend will re-validate the session and actual deployment status.

    // const currentToken = sessionStorage.getItem('sessionToken'); // No longer using sessionToken from sessionStorage
    // const currentUserId = sessionStorage.getItem('userId'); // No longer using userId from sessionStorage
    // const currentSessionId = sessionStorage.getItem('sessionId'); // No longer using sessionId from sessionStorage

    // sendBeacon relies on cookies being sent automatically by the browser.
    // Our /api/auth/beacon-signout-undeploy route uses validateSession, which now reads from cookies.
    // So, if cookies are present and sent by the browser, this should work.
    // We no longer need to check sessionStorage for tokens here.
    // A simple check for `username` in sessionStorage might indicate an active session from client's perspective.
    const storedUser = sessionStorage.getItem('username');

    if (storedUser) { // If there's a username, assume a session might be active.
      if (navigator.sendBeacon) {
        const beaconUrl = '/api/auth/beacon-signout-undeploy';
        // sendBeacon with POST and a body (even empty) is common.
        // Cookies should be sent automatically by the browser.
        navigator.sendBeacon(beaconUrl, new Blob([JSON.stringify({})], {type : 'application/json'})); 
        console.log('Attempted to send beacon for signout and undeploy. Backend will use cookies for session validation.');
      } else {
        console.warn('navigator.sendBeacon is not available.');
      }
    }
  };

  window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      if (activationProgressTimerId !== null) {
        window.clearInterval(activationProgressTimerId);
      }
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [router, isClient, isDeployed]); // Added isDeployed to re-evaluate if needed, though direct sessionStorage access in handler is better.

  const startDeploymentCheck = async (suffixedUsernameForJobSearch: string | null) => {
    if (!suffixedUsernameForJobSearch) {
      setDeploymentStatus('Logical username (suffixed) not available for status check.');
      setIsPollingStatus(false);
      return;
    }
    // Clear any existing activation progress timer specifically, others handled by clearAllPollingTimers if called before this
    if (activationProgressTimerId !== null) {
      window.clearInterval(activationProgressTimerId);
      setActivationProgressTimerId(null);
    }
    
    setIsPollingStatus(true); // Explicitly set polling status true for this operation
    setRedeployMode(false);

    const jobNameToFind = `Run for ${suffixedUsernameForJobSearch}`;
    console.log(`Initiating workflow run search. Target job name: "${jobNameToFind}"`);

    const authHeaders = getApiAuthHeaders(); // Primarily for Content-Type

    // findRunIdTimer is now findRunIdTimerRef.current
    const findRunIdTimeoutDuration = 30 * 1000;
    const findRunIdInterval = 5 * 1000;
    const findRunIdStartTime = Date.now();

    const attemptToFindRunId = async () => {
      console.log(`Attempting to find workflow run ID for job "${jobNameToFind}" using new endpoint (activeOnly=true).`);

      const attemptNumber = Math.floor((Date.now() - findRunIdStartTime) / findRunIdInterval) + 1;
      setDeploymentStatus(`Locating workflow run (attempt ${attemptNumber})...`);

      if (Date.now() - findRunIdStartTime > findRunIdTimeoutDuration) {
        if (findRunIdTimerRef.current !== null) window.clearInterval(findRunIdTimerRef.current);
        findRunIdTimerRef.current = null;
        console.error(`Timeout: Could not find a workflow run with job "${jobNameToFind}" within ${findRunIdTimeoutDuration / 1000}s.`);
        setDeploymentStatus('Could not locate the triggered workflow run in time. Please check GitHub Actions or try again.');
        setIsPollingStatus(false);
        setRedeployMode(true);
        return;
      }

      try {
        const response = await fetch(`/api/git/latest-user-run?logicalUsername=${suffixedUsernameForJobSearch}&activeOnly=true`, { headers: authHeaders });

        if (response.ok) {
          const data = await response.json() as LatestUserRunResponse;
          if (data.runId && data.jobName === jobNameToFind) {
            if (findRunIdTimerRef.current !== null) window.clearInterval(findRunIdTimerRef.current);
            findRunIdTimerRef.current = null;
            console.log(`Successfully found run ID: ${data.runId} for job "${data.jobName}". Proceeding to status polling.`);
            pollRunStatus(data.runId);
          } else {
            console.warn(`Active run found (ID: ${data.runId}, Job: "${data.jobName}"), but job name did not match target "${jobNameToFind}". Retrying...`);
            if (Date.now() - findRunIdStartTime <= findRunIdTimeoutDuration - findRunIdInterval) {
              findRunIdTimerRef.current = window.setTimeout(attemptToFindRunId, findRunIdInterval);
            } else {
              findRunIdTimerRef.current = window.setTimeout(attemptToFindRunId, 1000);
            }
          }
        } else if (response.status === 404) {
          console.log(`Active run for job "${jobNameToFind}" not yet found (404). Retrying...`);
          if (Date.now() - findRunIdStartTime <= findRunIdTimeoutDuration - findRunIdInterval) {
            findRunIdTimerRef.current = window.setTimeout(attemptToFindRunId, findRunIdInterval);
          } else {
            findRunIdTimerRef.current = window.setTimeout(attemptToFindRunId, 1000);
          }
        } else {
          const errorData = await response.json();
          throw new Error(`Failed to find run: ${response.status} ${errorData.message || ''}`);
        }
      } catch (error) {
        console.error('Error during attemptToFindRunId:', error);
        if (Date.now() - findRunIdStartTime <= findRunIdTimeoutDuration - findRunIdInterval) {
            findRunIdTimerRef.current = window.setTimeout(attemptToFindRunId, findRunIdInterval);
        } else if (Date.now() - findRunIdStartTime <= findRunIdTimeoutDuration) {
            findRunIdTimerRef.current = window.setTimeout(attemptToFindRunId, 1000);
        } else {
            if (findRunIdTimerRef.current !== null) window.clearInterval(findRunIdTimerRef.current);
            findRunIdTimerRef.current = null;
            setDeploymentStatus(`Error while trying to find workflow run: ${error instanceof Error ? error.message : String(error)}`);
            setIsPollingStatus(false);
            setRedeployMode(true);
        }
      }
    };

    const pollRunStatus = (runIdToPoll: number) => {
      setDeploymentStatus(`Monitoring run ID: ${runIdToPoll}. Waiting for status updates...`);
      const pollingTimeout = 3 * 60 * 1000;
      const pollIntervalTime = 10 * 1000;
      const statusPollStartTime = Date.now();
      // statusPollTimer is now statusPollTimerRef.current

      const performStatusPoll = async () => {
        if (Date.now() - statusPollStartTime > pollingTimeout) {
          if (statusPollTimerRef.current !== null) window.clearInterval(statusPollTimerRef.current);
          statusPollTimerRef.current = null;
          setDeploymentStatus('Deployment timed out while waiting for "in_progress" status. Please try again.');
          setIsDeployed(false);
          setIsPollingStatus(false);
          setRedeployMode(true);
          return;
        }
        try {
          const runStatusResponse = await fetch(`/git/galaxyapi/runs?runId=${runIdToPoll}`, { headers: authHeaders });
          if (!runStatusResponse.ok) {
            if (statusPollTimerRef.current !== null) window.clearInterval(statusPollTimerRef.current);
            statusPollTimerRef.current = null;
            const errorText = await runStatusResponse.text();
            setDeploymentStatus(`Failed to fetch deployment status from backend. ${errorText}`);
            setIsPollingStatus(false); setIsDeployed(false); setRedeployMode(true);
            return;
          }
          const runDetails = await runStatusResponse.json();
          if (runDetails.status === 'in_progress') {
            if (statusPollTimerRef.current !== null) window.clearInterval(statusPollTimerRef.current);
            statusPollTimerRef.current = null;
            setIsDeployed(true); setRedeployMode(false);
            setDeploymentStatus('Finalizing KickLock activation...');
            setIsPollingStatus(true); setActivationProgressPercent(0); // isPollingStatus is already true, this is for progress bar
            let currentProgress = 0; const totalDuration = 30;
            const newActivationTimerId = window.setInterval(() => {
              currentProgress += 1;
              const percent = Math.min(100, (currentProgress / totalDuration) * 100);
              setActivationProgressPercent(percent);
              if (currentProgress >= totalDuration) {
                window.clearInterval(newActivationTimerId);
                setActivationProgressTimerId(null);
                setShowDeployPopup(false); setIsPollingStatus(false); setActivationProgressPercent(100);
                setDeploymentStatus('KickLock activated successfully!');
              }
            }, 1000);
            setActivationProgressTimerId(newActivationTimerId);
          } else {
            setDeploymentStatus(`Workflow status: ${runDetails.status} (Conclusion: ${runDetails.conclusion || 'N/A'}). Waiting...`);
            statusPollTimerRef.current = window.setTimeout(performStatusPoll, pollIntervalTime);
          }
        } catch (pollError) {
          if (statusPollTimerRef.current !== null) window.clearInterval(statusPollTimerRef.current);
          statusPollTimerRef.current = null;
          setDeploymentStatus('Error polling deployment status. Please try again.');
          setIsDeployed(false); setIsPollingStatus(false); setRedeployMode(true);
        }
      };
      statusPollTimerRef.current = window.setTimeout(performStatusPoll, 0);
    };
    attemptToFindRunId();
  };

  const pollForCancelledStatus = async (runId: number) => {
    const pollTimeout = 60 * 1000;
    const pollInterval = 5 * 1000;
    const startTime = Date.now();
    // timer is now cancelPollTimerRef.current

    console.log(`Polling for cancellation of run ID: ${runId}`);
    const authHeaders = getApiAuthHeaders(); // Primarily for Content-Type
    // The check for authHeaders['Authorization'] is removed.

    const check = async () => {
      console.log(`pollForCancelledStatus: Checking run ${runId}...`);
        if (Date.now() - startTime > pollTimeout) {
          if (cancelPollTimerRef.current !== null) window.clearInterval(cancelPollTimerRef.current);
          cancelPollTimerRef.current = null;
          setDeploymentStatus('Timed out waiting for cancellation confirmation. You may need to redeploy.');
          console.log(`pollForCancelledStatus: Timed out for run ${runId}.`);
          setIsUndeploying(false);
          setIsPollingStatus(false); // Ensure polling status is reset
          setIsDeployed(false);
          setRedeployMode(true);
          setShowDeployPopup(true);
          return;
        }
  
      try {
        const response = await fetch(`/git/galaxyapi/runs?runId=${runId}`, { headers: authHeaders });
          if (!response.ok) {
            if (cancelPollTimerRef.current !== null) window.clearInterval(cancelPollTimerRef.current);
            cancelPollTimerRef.current = null;
            const errorText = await response.text();
            setDeploymentStatus(`Error fetching run status during undeploy from backend. ${errorText}`);
            console.error(`pollForCancelledStatus: Error fetching status for run ${runId} from backend. Status: ${response.status}`);
            setIsUndeploying(false);
            setIsPollingStatus(false); // Ensure polling status is reset
            setIsDeployed(false);
            setRedeployMode(true);
            setShowDeployPopup(true);
            return;
          }
        const runDetails = await response.json();
        console.log(`pollForCancelledStatus: Run ${runId} status: ${runDetails.status}, conclusion: ${runDetails.conclusion}`);

        if (runDetails.status === 'completed' && runDetails.conclusion === 'cancelled') {
          if (cancelPollTimerRef.current !== null) window.clearInterval(cancelPollTimerRef.current);
          cancelPollTimerRef.current = null;
          setDeploymentStatus('Deployment successfully cancelled.');
          setIsDeployed(false);
          setIsUndeploying(false);
          setIsPollingStatus(false); // Ensure polling status is reset
          setShowDeployPopup(true);
          setRedeployMode(false); 
          console.log(`pollForCancelledStatus: Run ${runId} successfully cancelled.`);
        } else if (runDetails.status === 'completed') {
          if (cancelPollTimerRef.current !== null) window.clearInterval(cancelPollTimerRef.current);
          cancelPollTimerRef.current = null;
          setDeploymentStatus(`Undeploy failed: Workflow completed (${runDetails.conclusion}), not cancelled. You may need to redeploy.`);
          console.log(`pollForCancelledStatus: Run ${runId} completed with ${runDetails.conclusion}, but was expected to be cancelled.`);
          setIsUndeploying(false);
          setIsPollingStatus(false); // Ensure polling status is reset
          setIsDeployed(false);
          setRedeployMode(true);
          setShowDeployPopup(true);
        } else {
          setDeploymentStatus(`Waiting for cancellation... Current status: ${runDetails.status}`);
          cancelPollTimerRef.current = window.setTimeout(check, pollInterval);
        }
      } catch (error) {
        if (cancelPollTimerRef.current !== null) window.clearInterval(cancelPollTimerRef.current);
        cancelPollTimerRef.current = null;
        setDeploymentStatus('Error checking cancellation status. You may need to redeploy.');
        console.error(`pollForCancelledStatus: Error polling run ${runId}:`, error);
        setIsUndeploying(false);
        setIsPollingStatus(false); // Ensure polling status is reset
        setIsDeployed(false);
        setRedeployMode(true);
        setShowDeployPopup(true);
      }
    };
    cancelPollTimerRef.current = window.setTimeout(check, 0);
  };

  const handleUndeploy = async () => {
    clearAllPollingTimers(); // Clear any ongoing deploy polling
    if (!username) {
      alert('Username not found.'); return;
    }
    // activationProgressTimerId is cleared by clearAllPollingTimers if it was part of it,
    // or cleared individually if not. It's already state, so direct set is fine.
    if (activationProgressTimerId !== null) {
      window.clearInterval(activationProgressTimerId);
      setActivationProgressTimerId(null);
    }
    setActivationProgressPercent(0); // Reset progress

    setButtonStates1(initialButtonStates); setButtonStates2(initialButtonStates); setButtonStates3(initialButtonStates);
    setButtonStates4(initialButtonStates); setButtonStates5(initialButtonStates);
    setError1([]); setError2([]); setError3([]); setError4([]); setError5([]);
    setIsUndeploying(true);
    setIsPollingStatus(true); // Indicates an operation is in progress (undeploy polling)
    setShowDeployPopup(true);
    setDeploymentStatus('Attempting to cancel current deployment...');

    const authHeaders = getApiAuthHeaders();
    // The check for authHeaders['Authorization'] is removed.
    
    const suffixedUsernameForJobSearch = username; 

    try {
      if (!suffixedUsernameForJobSearch) {
        alert('Logical username (suffixed) not available for undeploy operation.');
        setIsUndeploying(false); setShowDeployPopup(true); return;
      }
      console.log(`handleUndeploy: Fetching latest active run for job "Run for ${suffixedUsernameForJobSearch}" to cancel.`);
      const latestRunResponse = await fetch(`/api/git/latest-user-run?logicalUsername=${suffixedUsernameForJobSearch}&activeOnly=true`, { headers: authHeaders });

      if (latestRunResponse.ok) {
        const latestRunData = await latestRunResponse.json() as LatestUserRunResponse;
        if (latestRunData.jobName !== `Run for ${suffixedUsernameForJobSearch}`) {
            console.warn(`handleUndeploy: Found active run (ID ${latestRunData.runId}, Job "${latestRunData.jobName}") but job name mismatch. Target: "Run for ${suffixedUsernameForJobSearch}".`);
            setDeploymentStatus(`Found an active run, but not the target deployment for "Run for ${suffixedUsernameForJobSearch}".`);
            setIsUndeploying(false); setShowDeployPopup(true); return;
        }
        if (latestRunData.status === 'in_progress' || latestRunData.status === 'queued' || latestRunData.status === 'waiting') {
          const runIdToCancel = latestRunData.runId;
          console.log(`handleUndeploy: Found active run ID ${runIdToCancel} (Job: "${latestRunData.jobName}", Status: ${latestRunData.status}). Attempting to cancel.`);
          const cancelResponse = await fetch(`/git/galaxyapi/runs?cancelRunId=${runIdToCancel}`, { method: 'POST', headers: authHeaders });
          if (cancelResponse.status === 202) {
            setDeploymentStatus(`Cancellation request sent for run ${runIdToCancel}. Monitoring...`);
            pollForCancelledStatus(runIdToCancel);
          } else {
            const errorText = await cancelResponse.text(); const errorData = JSON.parse(errorText || "{}");
            throw new Error(`Failed to cancel workflow run ${runIdToCancel}: ${cancelResponse.status} ${errorData.message || errorText}`);
          }
        } else {
          setDeploymentStatus(`No active (in_progress/queued) deployment found for job "Run for ${suffixedUsernameForJobSearch}" to cancel. Latest status: ${latestRunData.status}.`);
          setIsUndeploying(false); setShowDeployPopup(true); return;
        }
      } else if (latestRunResponse.status === 404) {
        setDeploymentStatus(`No active deployment found for job "Run for ${suffixedUsernameForJobSearch}" to cancel.`);
        setIsUndeploying(false); setIsDeployed(false); setRedeployMode(false); setShowDeployPopup(true); return;
      } else {
        const errorText = await latestRunResponse.text();
        throw new Error(`Failed to fetch latest run for undeploy: ${latestRunResponse.status} ${errorText}`);
      }
    } catch (error: any) {
      console.error('handleUndeploy: Error caught:', error);
      setDeploymentStatus(`Error during undeploy: ${error.message}. You may need to redeploy.`);
      setIsUndeploying(false); setIsDeployed(false); setRedeployMode(true); setShowDeployPopup(true);
    }
  };

  const handleDeploy = async () => {
    clearAllPollingTimers(); // Clear any ongoing undeploy polling
    if (!username) {
      alert('Username not found. Please log in again.'); return;
    }
    if (activationProgressTimerId !== null) { // Also cleared by clearAllPollingTimers if it was part of it
      window.clearInterval(activationProgressTimerId);
      setActivationProgressTimerId(null);
    }
    setActivationProgressPercent(0); // Reset progress

    setIsDeploying(true); // Indicates the dispatch API call is happening
    setRedeployMode(false);
    setShowDeployPopup(true);
    setDeploymentStatus('Dispatching workflow...');
    // setIsPollingStatus(false); // Will be set to true by startDeploymentCheck if dispatch is successful

    const authHeaders = getApiAuthHeaders();
    // The check for authHeaders['Authorization'] is removed.
    
    try {
      const response = await fetch(`/git/galaxyapi/workflow-dispatch`, {
        method: 'POST',
        headers: authHeaders, 
        body: JSON.stringify({ username: username }) 
      });
      setIsDeploying(false); 

      if (response.status === 204) {
        setDeploymentStatus('Waiting 10s for to initialize run...');
        setIsPollingStatus(true); 
        setShowDeployPopup(true); 

        window.setTimeout(() => {
          if (username) { 
            startDeploymentCheck(username); 
          } else {
            console.error("Cannot start deployment check: suffixed username (state: username) is not set.");
            setDeploymentStatus("Error: User details not fully loaded for deployment check.");
            setIsPollingStatus(false);
            setRedeployMode(true);
          }
        }, 10000); 
      } else {
        const errorText = await response.text();
        const errorData = JSON.parse(errorText || "{}");
        setDeploymentStatus(`Dispatch failed via backend: ${response.status} ${errorData.message || errorText}`);
        setIsDeployed(false); 
        setIsPollingStatus(false); 
        setRedeployMode(true); 
      }
    } catch (error) {
      setIsDeploying(false); 
      setDeploymentStatus(`Dispatch error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsDeployed(false); 
      setIsPollingStatus(false); 
      setRedeployMode(true); 
    }
  };
  
  const [formData1, setFormData1] = useState<FormData>({ RC: '', startAttackTime: '', stopAttackTime: '', attackIntervalTime: '', startDefenceTime: '', stopDefenceTime: '', defenceIntervalTime: '', PlanetName: '', Rival: '' });
  const [formData2, setFormData2] = useState<FormData>({ RC: '', startAttackTime: '', stopAttackTime: '', attackIntervalTime: '', startDefenceTime: '', stopDefenceTime: '', defenceIntervalTime: '', PlanetName: '', Rival: '' });
  const [formData3, setFormData3] = useState<FormData>({ RC: '', startAttackTime: '', stopAttackTime: '', attackIntervalTime: '', startDefenceTime: '', stopDefenceTime: '', defenceIntervalTime: '', PlanetName: '', Rival: '' });
  const [formData4, setFormData4] = useState<FormData>({ RC: '', startAttackTime: '', stopAttackTime: '', attackIntervalTime: '', startDefenceTime: '', stopDefenceTime: '', defenceIntervalTime: '', PlanetName: '', Rival: '' });
  const [formData5, setFormData5] = useState<FormData>({ RC: '', startAttackTime: '', stopAttackTime: '', attackIntervalTime: '', startDefenceTime: '', stopDefenceTime: '', defenceIntervalTime: '', PlanetName: '', Rival: '' });
  
  const [buttonStates1, setButtonStates1] = useState<ButtonStates>(initialButtonStates);
  const [buttonStates2, setButtonStates2] = useState<ButtonStates>(initialButtonStates);
  const [buttonStates3, setButtonStates3] = useState<ButtonStates>(initialButtonStates);
  const [buttonStates4, setButtonStates4] = useState<ButtonStates>(initialButtonStates);
  const [buttonStates5, setButtonStates5] = useState<ButtonStates>(initialButtonStates);
  
  const [error1, setError1] = useState<string[]>([]);
  const [error2, setError2] = useState<string[]>([]);
  const [error3, setError3] = useState<string[]>([]);
  const [error4, setError4] = useState<string[]>([]);
  const [error5, setError5] = useState<string[]>([]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (toastMessage) {
      timer = setTimeout(() => {
        setToastMessage(null);
      }, 5000); 
    }
    return () => clearTimeout(timer);
  }, [toastMessage]);
  
  const handleInputChange = (formNumber: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const timeFields = ['startAttackTime', 'stopAttackTime', 'attackIntervalTime', 'startDefenceTime', 'stopDefenceTime', 'defenceIntervalTime'];
    if (timeFields.includes(name)) {
      const numericValue = value.replace(/\D/g, '').slice(0, 5);
      switch(formNumber) {
        case 1: setFormData1(prevState => ({ ...prevState, [name]: numericValue })); break;
        case 2: setFormData2(prevState => ({ ...prevState, [name]: numericValue })); break;
        case 3: setFormData3(prevState => ({ ...prevState, [name]: numericValue })); break;
        case 4: setFormData4(prevState => ({ ...prevState, [name]: numericValue })); break;
        case 5: setFormData5(prevState => ({ ...prevState, [name]: numericValue })); break;
      }
    } else {
      switch(formNumber) {
        case 1: setFormData1(prevState => ({ ...prevState, [name]: value })); break;
        case 2: setFormData2(prevState => ({ ...prevState, [name]: value })); break;
        case 3: setFormData3(prevState => ({ ...prevState, [name]: value })); break;
        case 4: setFormData4(prevState => ({ ...prevState, [name]: value })); break;
        case 5: setFormData5(prevState => ({ ...prevState, [name]: value })); break;
      }
    }
  };
  
  const handleAction = (formNumber: number) => async (action: ActionType) => {
    const setButtonStates = (() => {
      switch(formNumber) {
        case 1: return setButtonStates1; case 2: return setButtonStates2; case 3: return setButtonStates3;
        case 4: return setButtonStates4; case 5: return setButtonStates5; default: return setButtonStates1;
      }
    })();
    const setError = (() => {
      switch(formNumber) {
        case 1: return setError1; case 2: return setError2; case 3: return setError3;
        case 4: return setError4; case 5: return setError5; default: return setError1;
      }
    })();
    const formData = (() => {
      switch(formNumber) {
        case 1: return formData1; case 2: return formData2; case 3: return formData3;
        case 4: return formData4; case 5: return formData5; default: return formData1;
      }
    })();

    const requiredFields: (keyof FormData)[] = ['RC', 'startAttackTime', 'stopAttackTime', 'attackIntervalTime', 'startDefenceTime', 'stopDefenceTime', 'defenceIntervalTime', 'PlanetName', 'Rival'];
    const emptyFields = requiredFields.filter(field => !formData[field]);

    if (emptyFields.length > 0) {
      const fieldDisplayNames = {
        RC: 'RC', startAttackTime: 'Start Attack Time', stopAttackTime: 'Stop Attack Time',
        attackIntervalTime: 'Attack Interval Time', startDefenceTime: 'Start Defence Time',
        stopDefenceTime: 'Stop Defence Time', defenceIntervalTime: 'Defence Interval Time',
        PlanetName: 'Planet Name', Rival: 'Rival'
      };
      setError(emptyFields);
      setToastMessage(`Please fill all highlighted fields.`);
      setButtonStates(prev => ({ ...prev, [action]: { ...prev[action], loading: false, active: false, text: action } }));
      return; 
    }

    setButtonStates(prev => ({ ...prev, [action]: { ...prev[action], loading: true } }));
    setError([]);

    const authHeaders = getApiAuthHeaders(); // Primarily for Content-Type
    // The check for authHeaders['Authorization'] is removed.

    try {
      if (!username) { 
        setError(['Logical username not available. Cannot perform action.']);
        setButtonStates(prev => ({ ...prev, [action]: { ...prev[action], loading: false } }));
        return;
      }
      const modifiedFormData = Object.entries(formData).reduce((acc, [key, value]) => {
        acc[`${key}${formNumber}`] = value; return acc;
      }, {} as Record<string, string>);
      const response = await fetch(`/api/localt/action`, {
        method: 'POST', headers: authHeaders,
        body: JSON.stringify({ action: action, formNumber: formNumber, formData: modifiedFormData, logicalUsername: username })
      });
      if (response.ok) {
        setButtonStates(prev => ({ ...prev, [action]: { loading: false, active: true, text: action === 'start' ? 'Running' : action === 'stop' ? 'Stopped' : 'Updated', },
          ...(action === 'start' ? { stop: { ...prev.stop, active: false, text: 'Stop' }, } : {}),
          ...(action === 'stop' ? { start: { ...prev.start, active: false, text: 'Start' }, } : {}),
          ...(action === 'update' ? { update: { loading: false, active: true, text: 'Updated' } } : {})
        }));
        setError([]);
      } else if (response.status === 409) {
        const errorData = await response.json();
        if (errorData.autoUndeployed) {
          setAutoUndeployMessage(errorData.message);
          setShowAutoUndeployPopup(true);
          setIsDeployed(false); // Service is no longer deployed
          setRedeployMode(true); // Encourage redeployment
          // Reset all button states for all forms as the service is globally stopped for the user
          setButtonStates1(initialButtonStates);
          setButtonStates2(initialButtonStates);
          setButtonStates3(initialButtonStates);
          setButtonStates4(initialButtonStates);
          setButtonStates5(initialButtonStates);
          // Optionally, clear errors for the current form
          setError([]); 
        } else {
          // Handle other 409 errors if necessary
          setError([`Conflict: ${errorData.message || 'Please try again'}`]);
          setButtonStates(prev => ({ ...prev, [action]: { ...prev[action], loading: false, active: false, text: action } }));
        }
      } else {
        const errorText = await response.text(); const errorData = JSON.parse(errorText || '{ "message": "Unknown error" }');
        console.error(`Error performing action ${action} for form ${formNumber} via backend:`, errorData);
        if (action === 'start') { setError([`Unable to start: ${errorData.message || 'Please try again'}`]); }
        else { setError([`Unable to ${action}: ${errorData.message || 'Please try again'}`]); }
        setButtonStates(prev => ({ ...prev, [action]: { ...prev[action], loading: false, active: false, text: action } }));
      }
    } catch (error) {
      console.error(`Client-side error performing action ${action} for form ${formNumber}:`, error);
      setError([`Unable to ${action}: Network error or client-side issue.`]);
      setButtonStates(prev => ({ ...prev, [action]: { ...prev[action], loading: false, active: false, text: action } }));
    }
  };

  const renderForm = (formNumber: number) => {
    const formData = (() => {
      switch(formNumber) { case 1: return formData1; case 2: return formData2; case 3: return formData3; case 4: return formData4; case 5: return formData5; default: return formData1;}
    })();
    const buttonStates = (() => {
      switch(formNumber) { case 1: return buttonStates1; case 2: return buttonStates2; case 3: return buttonStates3; case 4: return buttonStates4; case 5: return buttonStates5; default: return buttonStates1; }
    })();
    const error = (() => {
      switch(formNumber) { case 1: return error1; case 2: return error2; case 3: return error3; case 4: return error4; case 5: return error5; default: return error1; }
    })();
    const inputFields = [
      { key: 'RC', label: 'RC', color: '#FFFF00', type: 'text', maxLength: undefined, className: styles.input },
      { key: 'PlanetName', label: 'Planet Name', color: '#FFFFFF', type: 'text', maxLength: undefined, className: styles.input },
      { key: 'Rival', label: 'Rival', color: '#FFA500', type: 'text', maxLength: undefined, className: styles.input },
      { key: 'startAttackTime', label: 'Start Attack Time', color: '#FF0000', type: 'text', maxLength: 5, className: `${styles.input} ${styles.timeInput}` },
      { key: 'attackIntervalTime', label: 'Attack Interval Time', color: '#FFFFFF', type: 'text', maxLength: 5, className: `${styles.input} ${styles.timeInput}` },
      { key: 'stopAttackTime', label: 'Stop Attack Time', color: '#FF0000', type: 'text', maxLength: 5, className: `${styles.input} ${styles.timeInput}` },
      { key: 'startDefenceTime', label: 'Start Defence Time', color: '#00FFFF', type: 'text', maxLength: 5, className: `${styles.input} ${styles.timeInput}` },
      { key: 'defenceIntervalTime', label: 'Defence Interval Time', color: '#FFFFFF', type: 'text', maxLength: 5, className: `${styles.input} ${styles.timeInput}` },
      { key: 'stopDefenceTime', label: 'Stop Defence Time', color: '#00FFFF', type: 'text', maxLength: 5, className: `${styles.input} ${styles.timeInput}` },
    ];
    return (
      <div className={styles.formContent} style={{ display: activeTab === formNumber ? 'block' : 'none' }}>
        <div className={styles.form}>
          {inputFields.map(({ key, label, color, type, maxLength, className }) => (
            <div key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <label style={{ color: color, marginBottom: '0.5rem', textAlign: 'center' }}>{label}</label>
              <input type={type} name={key} value={formData[key as keyof FormData]} onChange={handleInputChange(formNumber)} className={className} maxLength={maxLength} autoComplete="off" onFocus={(e) => e.target.setAttribute('autocomplete', 'off')} style={{ backgroundColor: 'rgba(25, 0, 0, 0.7)', border: error.includes(key) ? '1px solid red' : '1px solid rgba(255, 0, 0, 0.3)', color: '#fff', WebkitTextFillColor: '#fff', width: '100%', padding: '0.5rem', boxSizing: 'border-box' }} title={error.includes(key) ? 'This field is required' : undefined} />
            </div>
          ))}
          <div className={styles.buttonGroup} style={{ gap: '20px', display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
            <button type="button" onClick={() => handleAction(formNumber)('start')} className={`${styles.button} ${buttonStates.start.loading ? styles.loadingButton : ''} ${buttonStates.start.active ? styles.buttonRunning : ''}`} disabled={!isDeployed || isDeploying || isPollingStatus || isUndeploying || buttonStates.start.loading} style={{ backgroundColor: buttonStates.start.active ? '#22c55e' : undefined }} > <Play size={16} /> <span>Start</span> </button>
            <button type="button" onClick={() => handleAction(formNumber)('stop')} className={`${styles.button} ${buttonStates.stop.loading ? styles.loadingButton : ''} ${buttonStates.stop.active ? styles.buttonStopped : ''}`} disabled={!isDeployed || isDeploying || isPollingStatus || isUndeploying || buttonStates.stop.loading} > <Square size={16} /> <span>Stop</span> </button>
            <button type="button" onClick={() => handleAction(formNumber)('update')} className={`${styles.button} ${buttonStates.update.loading ? styles.loadingButton : ''} ${buttonStates.update.active ? styles.buttonUpdated : ''}`} disabled={!isDeployed || isDeploying || isPollingStatus || isUndeploying || buttonStates.update.loading} style={{ backgroundColor: buttonStates.update.active ? '#3b82f6' : undefined }} > <RefreshCw size={16} /> <span>Update</span> </button>
            {renderStatusButton()}
          </div>
        </div>
      </div>
    );
  };

  const renderStatusButton = () => {
    if (isDeployed) {
      return ( <button onClick={handleUndeploy} disabled={isUndeploying} className={`${styles.button}`} style={{ minWidth: '120px', backgroundColor: '#22c55e', border: 'none' }} > {isUndeploying ? ( <> <RefreshCw size={16} /> <span>Undeploying...</span> </> ) : ( <> <CheckCircle size={16} /> <span>Deployed</span> </> )} </button> );
    } else {
      return ( <button onClick={() => setShowDeployPopup(true)} className={`${styles.button}`} style={{ minWidth: '120px', backgroundColor: '#dc2626', border: 'none' }} > <RefreshCw size={16} /> <span>Deploy</span> </button> );
    }
  };

  return (
    <div className={styles.container}>
      {toastMessage && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', backgroundColor: '#f87171', color: 'white', padding: '12px 20px', borderRadius: '6px', zIndex: 2000, display: 'flex', alignItems: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} style={{ background: 'none', border: 'none', color: 'white', marginLeft: '15px', cursor: 'pointer', fontSize: '18px', lineHeight: '1' }}>
            <X size={20} />
          </button>
        </div>
      )}
      <div className={styles.header} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '0px', backgroundColor: '#1a1a1a', borderRadius: '0px', margin: '0 0 20px 0', position: 'relative' }}>
        {displayedUsername && (
          <div style={{ color: '#fff', fontSize: '1.1rem', position: 'absolute', left: '-770px', top: '-25px' }}>
            <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
              <span style={{ marginRight: '4px' }}>Welcome:</span> <span>{displayedUsername}</span>
            </div>
            {tokenExpiryDisplay && (
              <div style={{ fontSize: '0.85rem', color: '#ccc', marginTop: '4px' }}>
                Token Expires: {tokenExpiryDisplay}
              </div>
            )}
          </div>
        )}
        <div style={{ marginLeft: 'auto' }}> <button onClick={handleLogout} className={`${styles.button} ${styles.logoutButton}`} > <LogOut size={16} /> <span>Logout</span> </button> </div>
      </div>
      <h1 className={styles.title}> <span className={styles.kickLock}>KICK ~ LOCK</span> </h1>
      <div className={styles.formContainer}>
        <div className={styles.tabsContainer}>
          {[1, 2, 3, 4, 5].map(num => ( <button key={num} className={`${styles.tabButton} ${activeTab === num ? styles.activeTab : ''}`} onClick={() => setActiveTab(num)} > {formNames[num as keyof typeof formNames]} </button> ))}
        </div>
        {renderForm(1)} {renderForm(2)} {renderForm(3)} {renderForm(4)} {renderForm(5)}
      </div>
      {showDeployPopup && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#1a1a1a', borderRadius: '8px', padding: '20px', width: '350px', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)', border: '1px solid #333', textAlign: 'center' }}>
            <h2 style={{ color: '#fff', marginBottom: '15px' }}> 
              {isDeployed && isPollingStatus && activationProgressTimerId !== null ? 'Activating KickLock' : isDeployed ? 'KickLock Active' : 'Deploy KickLock'}
            </h2>
            <p style={{ color: '#aaa', marginBottom: '10px', fontSize: '0.9rem', minHeight: '20px' }}> {deploymentStatus} </p>
            
            {isDeployed && isPollingStatus && activationProgressTimerId !== null && (
              <div style={{ marginBottom: '20px', width: '100%', backgroundColor: '#333', borderRadius: '4px', overflow: 'hidden' }}>
                <div 
                  style={{ 
                    width: `${activationProgressPercent}%`, 
                    height: '10px', 
                    backgroundColor: '#22c55e', 
                    transition: 'width 0.5s ease-in-out'
                  }}
                />
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'center', marginTop: (isDeployed && isPollingStatus && activationProgressTimerId !== null) ? '0' : '20px' }}>
              {(!isDeployed || redeployMode) && !(isDeployed && isPollingStatus && activationProgressTimerId !== null) ? ( 
                <button 
                  onClick={handleDeploy} 
                  disabled={isDeploying || (isPollingStatus && activationProgressTimerId === null) } 
                  style={{ 
                    padding: '10px 20px', borderRadius: '4px', border: 'none', 
                    backgroundColor: (isDeploying || (isPollingStatus && activationProgressTimerId === null)) ? '#555' : (redeployMode ? '#e67e22' : '#d32f2f'), 
                    color: 'white', fontWeight: 'bold', 
                    cursor: (isDeploying || (isPollingStatus && activationProgressTimerId === null)) ? 'not-allowed' : 'pointer', 
                    opacity: (isDeploying || (isPollingStatus && activationProgressTimerId === null)) ? 0.7 : 1, 
                    transition: 'all 0.3s ease', width: '100%' 
                  }} 
                > 
                  {isDeploying ? 'Dispatching...' : (isPollingStatus && activationProgressTimerId === null) ? 'Checking Status...' : (redeployMode ? 'Redeploy Again' : 'Deploy KickLock')} 
                </button>
              ) : isDeployed && !(isPollingStatus && activationProgressTimerId !== null) ? (
                 <p style={{color: '#22c55e'}}>Deployment is active!</p> 
              ) : null}
            </div>
            {(!isPollingStatus && !isDeploying && !isDeployed && !redeployMode && activationProgressTimerId === null) && ( 
              <button onClick={() => setShowDeployPopup(false)} style={{marginTop: '15px', background: 'none', border: '1px solid #555', color: '#aaa', padding: '5px 10px', borderRadius: '4px'}}> Close </button> 
            )}
          </div>
        </div>
      )}
      {showThankYouMessage && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#1a1a1a', borderRadius: '8px', padding: '20px', width: '300px', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)', border: '1px solid #333' }}>
            <h2 style={{ color: '#fff', marginBottom: '20px', textAlign: 'center' }}>Thank You for using KickLock</h2>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button onClick={async () => { setShowThankYouMessage(false); await handleDeploy(); }} style={{ padding: '10px 20px', borderRadius: '4px', border: 'none', backgroundColor: '#d32f2f', color: 'white', fontWeight: 'bold', cursor: 'pointer', width: '100%' }} > Deploy Again </button>
            </div>
          </div>
        </div>
      )}
      {showAutoUndeployPopup && autoUndeployMessage && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0, 0, 0, 0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1050 }}>
          <div style={{ backgroundColor: '#2a2a2a', color: '#fff', borderRadius: '8px', padding: '30px', width: '400px', boxShadow: '0 5px 25px rgba(0, 0, 0, 0.6)', border: '1px solid #444', textAlign: 'center' }}>
            <h2 style={{ color: '#f39c12', marginBottom: '15px', fontSize: '1.5rem' }}>Session Expired</h2>
            <p style={{ color: '#ccc', marginBottom: '25px', fontSize: '1rem', lineHeight: '1.6' }}>{autoUndeployMessage}</p>
            <div style={{ display: 'flex', justifyContent: 'space-around', gap: '15px' }}>
              <button 
                onClick={() => {
                  setShowAutoUndeployPopup(false);
                  setAutoUndeployMessage(null);
                  // Ensure the main deploy popup shows if not already handled by redeployMode
                  setShowDeployPopup(true); 
                  handleDeploy(); // Trigger redeploy
                }} 
                style={{ padding: '12px 25px', borderRadius: '5px', border: 'none', backgroundColor: '#e67e22', color: 'white', fontWeight: 'bold', cursor: 'pointer', flex: 1, transition: 'background-color 0.3s ease' }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#d35400'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#e67e22'}
              >
                Redeploy KickLock
              </button>
              <button 
                onClick={() => {
                  setShowAutoUndeployPopup(false);
                  setAutoUndeployMessage(null);
                  // Ensure the main deploy popup shows if not already handled by redeployMode
                  setShowDeployPopup(true); 
                }} 
                style={{ padding: '12px 25px', borderRadius: '5px', border: '1px solid #555', backgroundColor: '#444', color: '#ccc', cursor: 'pointer', flex: 1, transition: 'background-color 0.3s ease' }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#555'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#444'}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GalaxyForm;
