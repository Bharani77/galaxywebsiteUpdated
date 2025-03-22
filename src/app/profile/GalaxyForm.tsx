import React, { useState } from 'react';
import { Play, Square, RefreshCw, LogOut } from 'lucide-react';
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
  
  // Form names for each tab
  const formNames = {
    1: 'Nebula Control',
    2: 'Star Fleet',
    3: 'Dark Matter',
    4: 'Quantum Void',
    5: 'Solar Dominion'
  };
  
  const handleLogout = () => {
    // Clear session storage
    sessionStorage.clear();
    // Redirect to signin page
    router.push('/signin');
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
    
    // For time fields, only allow up to 5 digits
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
      // Modify the form data to append the form number to each field
      const modifiedFormData = Object.entries(formData).reduce((acc, [key, value]) => {
        acc[`${key}${formNumber}`] = value;
        return acc;
      }, {} as Record<string, string>);
  
      const response = await fetch(`https://bharani77--web-web-app.modal.run/${action}/${formNumber}`, {
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
            text: action === 'start' ? 'Running' : action === 'stop' ? 'Stopped' : 'Updated'
          },
          ...(action === 'start' ? { stop: { ...prev.stop, active: false, text: 'Stop' } } : {}),
          ...(action === 'stop' ? { start: { ...prev.start, active: false, text: 'Start' } } : {})
        }));
      } else {
        throw new Error(`Failed to ${action} galaxy`);
      }
    } catch (error) {
      setError(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
          
          <div className={styles.buttonGroup}>
            <button
              type="button"
              onClick={() => handleAction(formNumber)('start')}
              className={`${styles.button} ${buttonStates.start.loading ? styles.loadingButton : ''} 
                ${buttonStates.start.active ? styles.buttonRunning : ''}`}
              disabled={buttonStates.start.loading}
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
          </div>
        </div>
      </div>
    );
  };
  
  return (
    <div className={styles.container}>
      <div className={styles.stars}></div>
      <div className={styles.nebula}></div>
      <button 
        onClick={handleLogout}
        className={`${styles.button} ${styles.logoutButton}`}
      >
        <LogOut size={16} />
        <span>Logout</span>
      </button>
      
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
    </div>
  );
};

export default GalaxyForm;