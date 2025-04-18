import React, { useState, useEffect } from 'react';
import { Play, Square, RefreshCw, LogOut, CheckCircle } from 'lucide-react';
import styles from '../styles/GalaxyControl.module.css';
import { useRouter } from 'next/navigation';

type FormData = {
  RC: string;
  Rival: string;
  AttackTime: string;
  IntervalTime: string;
  DefenceTime: string;
  PlanetName: string;
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

const GalaxyForm: React.FC = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<number>(1);
  const [username, setUsername] = useState<string | null>(null);
  const [showDeployPopup, setShowDeployPopup] = useState<boolean>(false);
  const [isDeploying, setIsDeploying] = useState<boolean>(false);
  const [isUndeploying, setIsUndeploying] = useState<boolean>(false);
  const [deploymentStatus, setDeploymentStatus] = useState<string>('');
  const [isDeployed, setIsDeployed] = useState<boolean>(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState<boolean>(true);
  const [showThankYouMessage, setShowThankYouMessage] = useState<boolean>(false);
  
  const formNames = {
    1: 'Kick 1',
    2: 'Kick 2',
    3: 'Kick 3',
    4: 'Kick 4',
    5: 'Kick 5'
  };
  
  const handleLogout = async () => {
    if (isDeployed) {
      try {
        setIsUndeploying(true);
        const response = await fetch('https://buddymaster77hugs-gradio1.hf.space/api/undeploy', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            modal_name: username
          })
        });
  
        if (!response.ok) {
          const errorData = await response.json();
          alert(`Undeployment failed: ${errorData.message || 'Unknown error'}`);
          return;
        }
        
        // Set deployment state to false before logout
        setIsDeployed(false);
        // Clear any deployment related states
        setDeploymentStatus('');
        setShowDeployPopup(false);
        setShowThankYouMessage(false);
      } catch (error) {
        alert(`Undeployment error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return;
      } finally {
        setIsUndeploying(false);
      }
    }
    
    sessionStorage.clear();
    router.push('/signin');
  };

  useEffect(() => {
    const storedUsername = sessionStorage.getItem('username');
    if (storedUsername) {
      setUsername(storedUsername);
      checkDeploymentStatus(storedUsername);
    } else {
      setIsCheckingStatus(false);
    }
  }, []);

  const checkDeploymentStatus = async (username: string) => {
    setIsCheckingStatus(true);
    let isAlreadyDeployed = false;
    
    try {
      const response = await fetch('https://buddymaster77hugs-gradio1.hf.space/api/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          modal_name: username
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status === "deployed") {
          isAlreadyDeployed = true;
          setIsDeployed(true);
        }
      }
    } catch (error) {
      console.error("Error checking deployment status:", error);
    } finally {
      setIsCheckingStatus(false);
      setShowDeployPopup(!isAlreadyDeployed);
    }
  };

  const handleUndeploy = async () => {
    if (!username) {
      alert('Username not found. Please log in again.');
      return;
    }

    setIsUndeploying(true);
    
    try {
      const response = await fetch('https://buddymaster77hugs-gradio1.hf.space/api/undeploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          modal_name: username
        })
      });

      if (response.ok) {
        setIsDeployed(false);
        setShowThankYouMessage(true);
      } else {
        const errorData = await response.json();
        alert(`Undeployment failed: ${errorData.message || 'Unknown error'}`);
      }
    } catch (error) {
      alert(`Undeployment error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUndeploying(false);
    }
  };

  const handleDeploy = async () => {
    if (!username) {
      alert('Username not found. Please log in again.');
      return;
    }

    setIsDeploying(true);
    
    try {
      const response = await fetch('https://buddymaster77hugs-gradio1.hf.space/api/deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          repo_url: 'https://github.com/octocat/Hello-World.git',
          modal_name: username
        })
      });

      if (response.ok) {
        setDeploymentStatus('Successfully deployed');
        setIsDeployed(true);
        setTimeout(() => {
          setShowDeployPopup(false);
        }, 2000);
      } else {
        const errorData = await response.json();
        setDeploymentStatus(`Deployment failed: ${errorData.message || 'Unknown error'}`);
      }
    } catch (error) {
      setDeploymentStatus(`Deployment error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsDeploying(false);
    }
  };
  
  const [formData1, setFormData1] = useState<FormData>({
    RC: '',
    Rival: '',
    AttackTime: '',
    IntervalTime: '',
    DefenceTime: '',
    PlanetName: ''
  });
  
  const [formData2, setFormData2] = useState<FormData>({
    RC: '',
    Rival: '',
    AttackTime: '',
    IntervalTime: '',
    DefenceTime: '',
    PlanetName: ''
  });
  
  const [formData3, setFormData3] = useState<FormData>({
    RC: '',
    Rival: '',
    AttackTime: '',
    IntervalTime: '',
    DefenceTime: '',
    PlanetName: ''
  });
  
  const [formData4, setFormData4] = useState<FormData>({
    RC: '',
    Rival: '',
    AttackTime: '',
    IntervalTime: '',
    DefenceTime: '',
    PlanetName: ''
  });
  
  const [formData5, setFormData5] = useState<FormData>({
    RC: '',
    Rival: '',
    AttackTime: '',
    IntervalTime: '',
    DefenceTime: '',
    PlanetName: ''
  });
  
  const [buttonStates1, setButtonStates1] = useState<ButtonStates>({
    start: { loading: false, active: false, text: 'Start' },
    stop: { loading: false, active: false, text: 'Stop' },
    update: { loading: false, active: false, text: 'Update' }
  });
  
  const [buttonStates2, setButtonStates2] = useState<ButtonStates>({
    start: { loading: false, active: false, text: 'Start' },
    stop: { loading: false, active: false, text: 'Stop' },
    update: { loading: false, active: false, text: 'Update' }
  });
  
  const [buttonStates3, setButtonStates3] = useState<ButtonStates>({
    start: { loading: false, active: false, text: 'Start' },
    stop: { loading: false, active: false, text: 'Stop' },
    update: { loading: false, active: false, text: 'Update' }
  });
  
  const [buttonStates4, setButtonStates4] = useState<ButtonStates>({
    start: { loading: false, active: false, text: 'Start' },
    stop: { loading: false, active: false, text: 'Stop' },
    update: { loading: false, active: false, text: 'Update' }
  });
  
  const [buttonStates5, setButtonStates5] = useState<ButtonStates>({
    start: { loading: false, active: false, text: 'Start' },
    stop: { loading: false, active: false, text: 'Stop' },
    update: { loading: false, active: false, text: 'Update' }
  });
  
  const [error1, setError1] = useState('');
  const [error2, setError2] = useState('');
  const [error3, setError3] = useState('');
  const [error4, setError4] = useState('');
  const [error5, setError5] = useState('');
  
  const handleInputChange = (formNumber: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const timeFields = ['AttackTime', 'IntervalTime', 'DefenceTime'];
    
    if (timeFields.includes(name)) {
      const numericValue = value.replace(/\D/g, '').slice(0, 5);
      switch(formNumber) {
        case 1:
          setFormData1(prevState => ({ ...prevState, [name]: numericValue }));
          break;
        case 2:
          setFormData2(prevState => ({ ...prevState, [name]: numericValue }));
          break;
        case 3:
          setFormData3(prevState => ({ ...prevState, [name]: numericValue }));
          break;
        case 4:
          setFormData4(prevState => ({ ...prevState, [name]: numericValue }));
          break;
        case 5:
          setFormData5(prevState => ({ ...prevState, [name]: numericValue }));
          break;
      }
    } else {
      switch(formNumber) {
        case 1:
          setFormData1(prevState => ({ ...prevState, [name]: value }));
          break;
        case 2:
          setFormData2(prevState => ({ ...prevState, [name]: value }));
          break;
        case 3:
          setFormData3(prevState => ({ ...prevState, [name]: value }));
          break;
        case 4:
          setFormData4(prevState => ({ ...prevState, [name]: value }));
          break;
        case 5:
          setFormData5(prevState => ({ ...prevState, [name]: value }));
          break;
      }
    }
  };
  
  const handleAction = (formNumber: number) => async (action: ActionType) => {
    const setButtonStates = (() => {
      switch(formNumber) {
        case 1: return setButtonStates1;
        case 2: return setButtonStates2;
        case 3: return setButtonStates3;
        case 4: return setButtonStates4;
        case 5: return setButtonStates5;
        default: return setButtonStates1;
      }
    })();
  
    const setError = (() => {
      switch(formNumber) {
        case 1: return setError1;
        case 2: return setError2;
        case 3: return setError3;
        case 4: return setError4;
        case 5: return setError5;
        default: return setError1;
      }
    })();
  
    const formData = (() => {
      switch(formNumber) {
        case 1: return formData1;
        case 2: return formData2;
        case 3: return formData3;
        case 4: return formData4;
        case 5: return formData5;
        default: return formData1;
      }
    })();
  
    setButtonStates(prev => ({
      ...prev,
      [action]: { ...prev[action], loading: true }
    }));
    setError('');
  
    try {
      const modifiedFormData = Object.entries(formData).reduce((acc, [key, value]) => {
        acc[`${key}${formNumber}`] = value;
        return acc;
      }, {} as Record<string, string>);
  
      const response = await fetch(`https://bharani77--${username}-web-app.modal.run/${action}/${formNumber}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(modifiedFormData)
      });
      
      if (response.ok) {
        setButtonStates(prev => ({
          ...prev,
          [action]: { 
            loading: false, 
            active: true, 
            text: action === 'start' ? 'Running' : action === 'stop' ? 'Stopped' : 'Updated',
          },
          ...(action === 'start' ? { 
            stop: { ...prev.stop, active: false, text: 'Stop' },
          } : {}),
          ...(action === 'stop' ? { 
            start: { ...prev.start, active: false, text: 'Start' },
          } : {})
        }));
        setError(''); // Clear any existing errors
      } else {
        // Simplified error message
        if (action === 'start') {
          setError('Unable to start - Please try again');
        } else {
          setError(`Unable to ${action} - Please try again`);
        }
        setButtonStates(prev => ({
          ...prev,
          [action]: { ...prev[action], loading: false, active: false, text: action }
        }));
      }
    } catch (error) {
      setError(`Unable to ${action} - Please try again`);
      setButtonStates(prev => ({
        ...prev,
        [action]: { ...prev[action], loading: false, active: false, text: action }
      }));
    }
  };
  
  const renderForm = (formNumber: number) => {
    const formData = (() => {
      switch(formNumber) {
        case 1: return formData1;
        case 2: return formData2;
        case 3: return formData3;
        case 4: return formData4;
        case 5: return formData5;
        default: return formData1;
      }
    })();
  
    const buttonStates = (() => {
      switch(formNumber) {
        case 1: return buttonStates1;
        case 2: return buttonStates2;
        case 3: return buttonStates3;
        case 4: return buttonStates4;
        case 5: return buttonStates5;
        default: return buttonStates1;
      }
    })();
  
    const error = (() => {
      switch(formNumber) {
        case 1: return error1;
        case 2: return error2;
        case 3: return error3;
        case 4: return error4;
        case 5: return error5;
        default: return error1;
      }
    })();
  
    const inputFields = [
      { key: 'RC', type: 'text', maxLength: undefined, className: styles.input },
      { key: 'Rival', type: 'text', maxLength: undefined, className: styles.input },
      { key: 'AttackTime', type: 'text', maxLength: 5, className: `${styles.input} ${styles.timeInput}` },
      { key: 'IntervalTime', type: 'text', maxLength: 5, className: `${styles.input} ${styles.timeInput}` },
      { key: 'DefenceTime', type: 'text', maxLength: 5, className: `${styles.input} ${styles.timeInput}` },
      { key: 'PlanetName', type: 'text', maxLength: undefined, className: styles.input }
    ];
  
    return (
      <div className={styles.formContent} style={{ display: activeTab === formNumber ? 'block' : 'none' }}>
        {error && <div className="text-red-500 mb-4">{error}</div>}
        <div className={styles.form}>
          {inputFields.map(({ key, type, maxLength, className }) => (
            <input
              key={key}
              type={type}
              name={key}
              value={formData[key as keyof FormData]}
              onChange={handleInputChange(formNumber)}
              placeholder={`${key}`}
              className={className}
              maxLength={maxLength}
            />
          ))}
          
          <div className={styles.buttonGroup} style={{ gap: '8px', display: 'flex', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => handleAction(formNumber)('start')}
              className={`${styles.button} ${buttonStates.start.loading ? styles.loadingButton : ''} 
                ${buttonStates.start.active ? styles.buttonRunning : ''}`}
              disabled={buttonStates.start.loading}
              style={{ 
                backgroundColor: buttonStates.start.active ? '#22c55e' : undefined
              }}
            >
              <Play size={16} />
              <span>Start</span>
            </button>
  
            <button
              type="button"
              onClick={() => handleAction(formNumber)('stop')}
              className={`${styles.button} ${buttonStates.stop.loading ? styles.loadingButton : ''} 
                ${buttonStates.stop.active ? styles.buttonStopped : ''}`}
              disabled={buttonStates.stop.loading}
            >
              <Square size={16} />
              <span>Stop</span>
            </button>
  
            <button
              type="button"
              onClick={() => handleAction(formNumber)('update')}
              className={`${styles.button} ${buttonStates.update.loading ? styles.loadingButton : ''} 
                ${buttonStates.update.active ? styles.buttonUpdated : ''}`}
              disabled={buttonStates.update.loading}
            >
              <RefreshCw size={16} />
              <span>Update</span>
            </button>

            {renderStatusButton()}
          </div>
        </div>
      </div>
    );
  };
  
  const renderStatusButton = () => {
    if (isCheckingStatus) {
      return (
        <button
          className={`${styles.button}`}
          disabled={true}
          style={{ 
            minWidth: '120px',
            backgroundColor: '#666' // Gray for checking state
          }}
        >
          <RefreshCw size={16} />
          <span>Checking...</span>
        </button>
      );
    } else if (isDeployed) {
      return (
        <button
          onClick={handleUndeploy}
          disabled={isUndeploying}
          className={`${styles.button}`}
          style={{ 
            minWidth: '120px',
            backgroundColor: '#22c55e', // Green for deployed state
            border: 'none'
          }}
        >
          {isUndeploying ? (
            <>
              <RefreshCw size={16} />
              <span>Undeploying...</span>
            </>
          ) : (
            <>
              <CheckCircle size={16} />
              <span>Deployed</span>
            </>
          )}
        </button>
      );
    } else {
      return (
        <button
          onClick={() => setShowDeployPopup(true)}
          className={`${styles.button}`}
          style={{ 
            minWidth: '120px',
            backgroundColor: '#dc2626', // Red for undeployed state
            border: 'none'
          }}
        >
          <RefreshCw size={16} />
          <span>Deploy</span>
        </button>
      );
    }
  };
  
  return (
    <div className={styles.container}>
      <div className={styles.header} style={{
        display: 'flex',
        alignItems: 'flex-start', // Changed from center to flex-start
        justifyContent: 'space-between',
        padding: '0px',
        backgroundColor: '#1a1a1a',
        borderRadius: '0px',
        margin: '0 0 20px 0',
        position: 'relative' // Added position relative
      }}>
        {username && (
          <div style={{
            color: '#fff',
            fontWeight: 'bold', 
            fontSize: '1.1rem',
            position: 'absolute', // Added absolute positioning
            left: '-625px',
            top: '-15px',
            display: 'flex',
            alignItems: 'center'
          }}>
            <span style={{ marginRight: '4px' }}>Welcome:</span>
            <span>{username}</span>
          </div>
        )}

        <div style={{ marginLeft: 'auto' }}> {/* Added container for logout button */}
          <button
            onClick={handleLogout}
            className={`${styles.button} ${styles.logoutButton}`}
          >
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </div>

      <h1 className={styles.title}>
        <span className={styles.kickLock}>KICK ~ LOCK</span>
      </h1>
      
      <div className={styles.formContainer}>
        <div className={styles.tabsContainer}>
          {[1, 2, 3, 4, 5].map(num => (
            <button
              key={num}
              className={`${styles.tabButton} ${activeTab === num ? styles.activeTab : ''}`}
              onClick={() => setActiveTab(num)}
            >
              {formNames[num as keyof typeof formNames]}
            </button>
          ))}
        </div>
        
        {renderForm(1)}
        {renderForm(2)}
        {renderForm(3)}
        {renderForm(4)}
        {renderForm(5)}
      </div>

      {/* Remove the deploy button section that was here */}

      {/* Deploy Popup */}
      {showDeployPopup && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#1a1a1a',
            borderRadius: '8px',
            padding: '20px',
            width: '300px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
            border: '1px solid #333'
          }}>
            <h2 style={{ color: '#fff', marginBottom: '20px', textAlign: 'center' }}>Deploy KickLock</h2>
            <p style={{ color: '#aaa', marginBottom: '20px', textAlign: 'center', fontSize: '0.9rem' }}>
              Deployment is required to use KickLock features
            </p>
            
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button
                onClick={handleDeploy}
                disabled={isDeploying || isDeployed}
                style={{
                  padding: '10px 20px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: isDeployed ? '#22c55e' : '#d32f2f',
                  color: 'white',
                  fontWeight: 'bold',
                  cursor: isDeploying || isDeployed ? 'not-allowed' : 'pointer',
                  opacity: isDeploying ? 0.7 : 1,
                  transition: 'all 0.3s ease',
                  width: '100%'
                }}
              >
                {isDeploying ? 'Deploying...' : isDeployed ? 'Deployed' : 'Deploy KickLock'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Thank You Message */}
      {showThankYouMessage && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#1a1a1a',
            borderRadius: '8px',
            padding: '20px',
            width: '300px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
            border: '1px solid #333'
          }}>
            <h2 style={{ color: '#fff', marginBottom: '20px', textAlign: 'center' }}>Thank You for using KickLock</h2>
            
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button
                onClick={async () => {
                  setShowThankYouMessage(false);
                  await handleDeploy();
                }}
                style={{
                  padding: '10px 20px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: '#d32f2f',
                  color: 'white',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  width: '100%'
                }}
              >
                Deploy Again
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GalaxyForm;