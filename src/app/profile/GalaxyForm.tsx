import React, { useState, useEffect, useCallback } from 'react';
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

interface LatestUserRunResponse {
  runId: number;
  status: string | null;
  conclusion: string | null;
  createdAt: string;
  htmlUrl: string;
  jobName: string;
}

const getApiAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = sessionStorage.getItem('sessionToken');
  const userId = sessionStorage.getItem('userId');
  const sessionId = sessionStorage.getItem('sessionId');

  if (token && userId && sessionId) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['X-User-ID'] = userId;
    headers['X-Session-ID'] = sessionId;
  } else {
    console.warn('Missing critical session data (token, userId, or sessionId) in sessionStorage. API calls will proceed without authentication headers.');
  }
  return headers;
};
  
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
      }
    }
    sessionStorage.clear();
    router.push('/signin');
  };

  const checkInitialDeploymentStatus = async (logicalUsernameToCheck: string) => {
    setDeploymentStatus('Checking deployment status...');
    try {
      const authHeaders = getApiAuthHeaders();
      if (!authHeaders['Authorization']) {
        setDeploymentStatus('Authentication details missing. Please sign in again.');
        setIsDeployed(false);
        setShowDeployPopup(true);
        return;
      }

      console.log(`Fetching latest run status for job name based on: ${logicalUsernameToCheck} via /api/git/latest-user-run`);
      const response = await fetch(`/api/git/latest-user-run?logicalUsername=${logicalUsernameToCheck}`, { headers: authHeaders });

      if (response.ok) {
        const data = await response.json() as LatestUserRunResponse;
        const isActiveStatus = data.status === 'in_progress' || data.status === 'queued';

        if (isActiveStatus) {
          console.log(`Active deployment found (Run ID: ${data.runId}, Job: "${data.jobName}", Status: ${data.status}).`);
          setIsDeployed(true);
          setShowDeployPopup(false);
          setDeploymentStatus(`Active deployment detected (Run ID: ${data.runId}, Status: ${data.status}).`);
        } else {
          console.log(`Latest run found (Run ID: ${data.runId}, Job: "${data.jobName}", Status: ${data.status}, Conclusion: ${data.conclusion}), but it's not currently active.`);
          setIsDeployed(false);
          setShowDeployPopup(true);
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
    const storedUsername = sessionStorage.getItem('username'); 
    if (storedUsername) {
      setDisplayedUsername(storedUsername);
      const suffix = '7890';
      const suffixedUsername = `${storedUsername}${suffix}`; 
      setUsername(suffixedUsername); 
      
      setShowDeployPopup(true);
      setDeploymentStatus('Checking deployment status...'); 
      checkInitialDeploymentStatus(suffixedUsername); 
    } else {
      setDeploymentStatus('Please sign in to manage deployments.');
      setIsDeployed(false);
      setShowDeployPopup(true);
      // router.push('/signin'); // Consider if redirect is needed if no username
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // Check isDeployed state at the moment of unload
      // Note: isDeployed might not be the most up-to-date from state here due to closure.
      // It's better to get it from sessionStorage or a ref if critical,
      // but for sendBeacon, we fire it if there's a chance it's deployed.
      // The backend will re-validate the session and actual deployment status.

      const currentToken = sessionStorage.getItem('sessionToken');
      const currentUserId = sessionStorage.getItem('userId');
      const currentSessionId = sessionStorage.getItem('sessionId');

      // A simple check: if there's a token, there might be a session and deployment.
      // The backend /api/auth/beacon-signout-undeploy will do the full validation.
      if (currentToken && currentUserId && currentSessionId) {
        if (navigator.sendBeacon) {
          // navigator.sendBeacon expects data. We send a minimal JSON payload.
          // The crucial part is that the browser should send cookies,
          // and our backend /api/auth/beacon-signout-undeploy uses validateSession which expects headers.
          // This is a known limitation/complexity of sendBeacon with header-based auth.
          // We are sending an empty JSON body as placeholder, the backend relies on headers.
          
          // To pass headers with sendBeacon, they must be part of the request object
          // that sendBeacon itself constructs. Custom headers are tricky.
          // The most reliable way is if your auth can work off cookies that the browser sends automatically.
          // Since validateSession is header-based, this is a best-effort attempt.
          
          // Create a FormData object to send. This is a common way to use sendBeacon.
          // However, our backend expects headers for validateSession.
          // Let's try sending a POST request with an empty body, hoping the
          // browser includes necessary cookies or that the server can handle it.
          // The custom headers 'Authorization', 'X-User-ID', 'X-Session-ID'
          // are NOT reliably sent by navigator.sendBeacon.
          // The backend API /api/auth/beacon-signout-undeploy/route.ts
          // calls validateSession(request) which reads these from headers.
          // This will likely fail if the browser doesn't attach them.
          // This is a fundamental limitation. The backend might need adjustment
          // for beacon-specific auth if this proves unreliable.

          // For now, we'll just fire the beacon. The backend will log if session is invalid.
          const beaconUrl = '/api/auth/beacon-signout-undeploy';
          navigator.sendBeacon(beaconUrl); 
          console.log('Attempted to send beacon for signout and undeploy.');
        } else {
          console.warn('navigator.sendBeacon is not available.');
          // Fallback for older browsers (less reliable) - synchronous XHR
          // This is generally discouraged as it blocks page unload.
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
    if (activationProgressTimerId !== null) { 
      window.clearInterval(activationProgressTimerId);
      setActivationProgressTimerId(null);
    }

    if (!isPollingStatus) setIsPollingStatus(true); 
    setRedeployMode(false);

    const jobNameToFind = `Run for ${suffixedUsernameForJobSearch}`; 
    console.log(`Initiating workflow run search. Target job name: "${jobNameToFind}"`);

    const authHeaders = getApiAuthHeaders();
    if (!authHeaders['Authorization']) {
      setDeploymentStatus('Authentication details missing for deployment check. Please sign in again.');
      setIsPollingStatus(false);
      setRedeployMode(true);
      return;
    }

    let findRunIdTimer: number | null = null;
    const findRunIdTimeoutDuration = 30 * 1000;
    const findRunIdInterval = 5 * 1000;
    const findRunIdStartTime = Date.now();

    const attemptToFindRunId = async () => {
      console.log(`Attempting to find workflow run ID for job "${jobNameToFind}" using new endpoint (activeOnly=true).`);
      
      const attemptNumber = Math.floor((Date.now() - findRunIdStartTime) / findRunIdInterval) + 1;
      setDeploymentStatus(`Locating workflow run (attempt ${attemptNumber})...`);

      if (Date.now() - findRunIdStartTime > findRunIdTimeoutDuration) {
        if (findRunIdTimer !== null) window.clearInterval(findRunIdTimer);
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
            if (findRunIdTimer !== null) window.clearInterval(findRunIdTimer);
            console.log(`Successfully found run ID: ${data.runId} for job "${data.jobName}". Proceeding to status polling.`);
            pollRunStatus(data.runId); 
          } else {
            console.warn(`Active run found (ID: ${data.runId}, Job: "${data.jobName}"), but job name did not match target "${jobNameToFind}". Retrying...`);
            if (Date.now() - findRunIdStartTime <= findRunIdTimeoutDuration - findRunIdInterval) {
              findRunIdTimer = window.setTimeout(attemptToFindRunId, findRunIdInterval);
            } else { 
               findRunIdTimer = window.setTimeout(attemptToFindRunId, 1000);
            }
          }
        } else if (response.status === 404) {
          console.log(`Active run for job "${jobNameToFind}" not yet found (404). Retrying...`);
          if (Date.now() - findRunIdStartTime <= findRunIdTimeoutDuration - findRunIdInterval) {
            findRunIdTimer = window.setTimeout(attemptToFindRunId, findRunIdInterval);
          } else { 
             findRunIdTimer = window.setTimeout(attemptToFindRunId, 1000);
          }
        } else {
          const errorData = await response.json();
          throw new Error(`Failed to find run: ${response.status} ${errorData.message || ''}`);
        }
      } catch (error) {
        console.error('Error during attemptToFindRunId:', error);
        if (Date.now() - findRunIdStartTime <= findRunIdTimeoutDuration - findRunIdInterval) {
            findRunIdTimer = window.setTimeout(attemptToFindRunId, findRunIdInterval);
        } else if (Date.now() - findRunIdStartTime <= findRunIdTimeoutDuration) {
            findRunIdTimer = window.setTimeout(attemptToFindRunId, 1000);
        } else {
            if (findRunIdTimer !== null) window.clearInterval(findRunIdTimer);
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
      let statusPollTimer: number | null = null;

      const performStatusPoll = async () => {
        if (Date.now() - statusPollStartTime > pollingTimeout) {
          if (statusPollTimer !== null) window.clearInterval(statusPollTimer);
          setDeploymentStatus('Deployment timed out while waiting for "in_progress" status. Please try again.');
          setIsDeployed(false);
          setIsPollingStatus(false);
          setRedeployMode(true);
          return;
        }
        try {
          const runStatusResponse = await fetch(`/git/galaxyapi/runs?runId=${runIdToPoll}`, { headers: authHeaders });
          if (!runStatusResponse.ok) {
            if (statusPollTimer !== null) window.clearInterval(statusPollTimer);
            const errorText = await runStatusResponse.text();
            setDeploymentStatus(`Failed to fetch deployment status from backend. ${errorText}`);
            setIsPollingStatus(false); setIsDeployed(false); setRedeployMode(true);
            return;
          }
          const runDetails = await runStatusResponse.json();
          if (runDetails.status === 'in_progress') {
            if (statusPollTimer !== null) window.clearInterval(statusPollTimer);
            setIsDeployed(true); setRedeployMode(false);
            setDeploymentStatus('Finalizing KickLock activation...');
            setIsPollingStatus(true); setActivationProgressPercent(0);
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
            statusPollTimer = window.setTimeout(performStatusPoll, pollIntervalTime);
          }
        } catch (pollError) {
          if (statusPollTimer !== null) window.clearInterval(statusPollTimer);
          setDeploymentStatus('Error polling deployment status. Please try again.');
          setIsDeployed(false); setIsPollingStatus(false); setRedeployMode(true);
        }
      };
      statusPollTimer = window.setTimeout(performStatusPoll, 0); 
    };
    attemptToFindRunId();
  };

  const pollForCancelledStatus = async (runId: number) => { 
    const pollTimeout = 60 * 1000; 
    const pollInterval = 5 * 1000; 
    const startTime = Date.now();
    let timer: number | null = null;
  
    console.log(`Polling for cancellation of run ID: ${runId}`);
    const authHeaders = getApiAuthHeaders();
    if (!authHeaders['Authorization']) {
      setDeploymentStatus('Authentication details missing for cancellation poll. Please sign in again.');
      setIsUndeploying(false); 
      return;
    }

    const check = async () => {
      console.log(`pollForCancelledStatus: Checking run ${runId}...`);
        if (Date.now() - startTime > pollTimeout) {
          if (timer !== null) window.clearInterval(timer);
          setDeploymentStatus('Timed out waiting for cancellation confirmation. You may need to redeploy.');
          console.log(`pollForCancelledStatus: Timed out for run ${runId}.`);
          setIsUndeploying(false);
          setIsDeployed(false);
          setRedeployMode(true);
          setShowDeployPopup(true);
          return;
        }
  
      try {
        const response = await fetch(`/git/galaxyapi/runs?runId=${runId}`, { headers: authHeaders });
          if (!response.ok) {
            if (timer !== null) window.clearInterval(timer);
            const errorText = await response.text();
            setDeploymentStatus(`Error fetching run status during undeploy from backend. ${errorText}`);
            console.error(`pollForCancelledStatus: Error fetching status for run ${runId} from backend. Status: ${response.status}`);
            setIsUndeploying(false);
            setIsDeployed(false);
            setRedeployMode(true);
            setShowDeployPopup(true);
            return;
          }
        const runDetails = await response.json();
        console.log(`pollForCancelledStatus: Run ${runId} status: ${runDetails.status}, conclusion: ${runDetails.conclusion}`);
  
        if (runDetails.status === 'completed' && runDetails.conclusion === 'cancelled') {
          if (timer !== null) window.clearInterval(timer);
          setDeploymentStatus('Deployment successfully cancelled.');
          setIsDeployed(false);
          setIsUndeploying(false);
          setShowDeployPopup(true); 
          setRedeployMode(false); 
          console.log(`pollForCancelledStatus: Run ${runId} successfully cancelled.`);
        } else if (runDetails.status === 'completed') {
          if (timer !== null) window.clearInterval(timer);
          setDeploymentStatus(`Undeploy failed: Workflow completed (${runDetails.conclusion}), not cancelled. You may need to redeploy.`);
          console.log(`pollForCancelledStatus: Run ${runId} completed with ${runDetails.conclusion}, but was expected to be cancelled.`);
          setIsUndeploying(false);
          setIsDeployed(false); 
          setRedeployMode(true);
          setShowDeployPopup(true);
        } else {
          setDeploymentStatus(`Waiting for cancellation... Current status: ${runDetails.status}`);
          timer = window.setTimeout(check, pollInterval);
        }
      } catch (error) {
        if (timer !== null) window.clearInterval(timer);
        setDeploymentStatus('Error checking cancellation status. You may need to redeploy.');
        console.error(`pollForCancelledStatus: Error polling run ${runId}:`, error);
        setIsUndeploying(false);
        setIsDeployed(false);
        setRedeployMode(true);
        setShowDeployPopup(true);
      }
    };
    timer = window.setTimeout(check, 0); 
  };

  const handleUndeploy = async () => {
    if (!username) { 
      alert('Username not found.'); return;
    }
    if (activationProgressTimerId !== null) {
      window.clearInterval(activationProgressTimerId); setActivationProgressTimerId(null);
    }
    setButtonStates1(initialButtonStates); setButtonStates2(initialButtonStates); setButtonStates3(initialButtonStates);
    setButtonStates4(initialButtonStates); setButtonStates5(initialButtonStates);
    setError1([]); setError2([]); setError3([]); setError4([]); setError5([]);
    setIsUndeploying(true); setShowDeployPopup(true);
    setDeploymentStatus('Attempting to cancel current deployment...');

    const authHeaders = getApiAuthHeaders();
    if (!authHeaders['Authorization']) {
      setDeploymentStatus('Authentication details missing. Please sign in again.');
      setIsUndeploying(false); setShowDeployPopup(true); return;
    }
    
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
    if (!username) { 
      alert('Username not found. Please log in again.'); return;
    }
    if (activationProgressTimerId !== null) {
      window.clearInterval(activationProgressTimerId);
      setActivationProgressTimerId(null);
    }
    setIsDeploying(true); 
    setRedeployMode(false); 
    setShowDeployPopup(true); 
    setDeploymentStatus('Dispatching workflow...'); 
    
    const authHeaders = getApiAuthHeaders();
    if (!authHeaders['Authorization']) {
      setDeploymentStatus('Authentication details missing for deploy. Please sign in again.');
      setIsDeploying(false);
      setRedeployMode(true);
      return;
    }
    
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

    const authHeaders = getApiAuthHeaders();
    if (!authHeaders['Authorization']) {
      setError(['Authentication details missing. Please sign in again.']);
      setButtonStates(prev => ({ ...prev, [action]: { ...prev[action], loading: false } }));
      return;
    }

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
        {displayedUsername && ( <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '1.1rem', position: 'absolute', left: '-770px', top: '-25px', display: 'flex', alignItems: 'center' }}> <span style={{ marginRight: '4px' }}>Welcome:</span> <span>{displayedUsername}</span> </div> )}
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
