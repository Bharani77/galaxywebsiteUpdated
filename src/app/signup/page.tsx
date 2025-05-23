"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { X, DollarSign, FileText, Info } from 'lucide-react'; // Import necessary icons

// const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL; // No longer needed
// const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; // No longer needed
// const supabase = createClient(supabaseUrl!, supabaseAnonKey!); // No longer needed

export default function SignUpPage() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [token, setToken] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [showTokenInfoPopup, setShowTokenInfoPopup] = useState(false);
    const [hasTokenInfoPopupBeenShown, setHasTokenInfoPopupBeenShown] = useState(false);
    const router = useRouter();

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const shown = sessionStorage.getItem('tokenInfoPopupShown');
            if (shown === 'true') {
                setHasTokenInfoPopupBeenShown(true);
            }
        }
    }, []);

    const showToast = (message: string, type: 'success' | 'error' = 'error') => {
        toast[type](message, {
            position: "top-right",
            autoClose: 3000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            theme: "dark"
        });
    };

    // verifyToken, associateTokenWithUser, and direct DB calls for user/token updates
    // are now handled by the /api/auth/signup backend route.

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (isLoading) return;
        
        setIsLoading(true);
        try {
            if (!username.trim() || !password.trim()) {
                showToast("Username and password cannot be empty.");
                setIsLoading(false);
                return;
            }

            // Add username validation: alphanumeric only, no spaces or special characters
            const usernameRegex = /^[a-zA-Z0-9]+$/;
            if (!usernameRegex.test(username)) {
                showToast("Username can only contain alphanumeric characters (A-Z, a-z, 0-9) and no spaces or special characters.");
                setIsLoading(false);
                return;
            }

            // Add password validation
            if (password.length < 8) {
                showToast("Password must be at least 8 characters long.");
                setIsLoading(false);
                return;
            }

            if (!token.trim()) {
                showToast("Token cannot be empty.");
                setIsLoading(false);
                return;
            }

            // Call the backend API for signup
            const response = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password, token }),
            });

            const data = await response.json();

            if (response.ok) { // Status 201 Created is also response.ok
                showToast(data.message || "Signup successful!", 'success');
                setTimeout(() => {
                    setUsername("");
                    setPassword("");
                    setToken("");
                    router.push("/signin");
                }, 2000);
            } else {
                showToast(data.message || "Signup failed. Please try again.");
            }
        } catch (error) {
            console.error("Signup error:", error);
            showToast("An unexpected error occurred during signup.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="welcome-container">
            <ToastContainer />
            <div className="auth-card max-w-md w-full p-8">
                <h1 className="text-center mb-8">
                    <span style={{ 
                        color: '#D32F2F',
                        fontFamily: 'Audiowide, cursive',
                        fontSize: '2rem',
                        textShadow: '0 0 10px rgba(211, 47, 47, 0.3)'
                    }}>
                        KICK ~ LOCK
                    </span>
                </h1>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="form-group">
                        <label className="block text-white text-sm font-semibold mb-2 text-left w-full">
                            Username
                        </label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="input-field"
                            placeholder="Enter username"
                            disabled={isLoading}
                        />
                    </div>

                    <div className="form-group">
                        <label className="block text-white text-sm font-semibold mb-2 text-left w-full">
                            Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="input-field"
                            placeholder="Enter password"
                            disabled={isLoading}
                        />
                    </div>

                    <div className="form-group">
                        <label className="block text-white text-sm font-semibold mb-2 text-left w-full">
                            Token
                        </label>
                        <input
                            type="text"
                            value={token}
                            onChange={(e) => setToken(e.target.value)}
                            onClick={() => {
                                if (!hasTokenInfoPopupBeenShown) {
                                    setShowTokenInfoPopup(true);
                                    setHasTokenInfoPopupBeenShown(true);
                                    sessionStorage.setItem('tokenInfoPopupShown', 'true');
                                }
                            }}
                            className="input-field"
                            placeholder="Enter token"
                            disabled={isLoading}
                        />
                    </div>

                    <button
                        type="submit"
                        className="welcome-button w-full mt-6"
                        disabled={isLoading}
                    >
                        {isLoading ? "Signing up..." : "Sign Up"}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <Link href="/signin" className="text-primary-color hover:text-secondary-color transition-colors">
                        Already have an account? Sign in
                    </Link>
                </div>
            </div>

            {showTokenInfoPopup && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                    backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'flex', justifyContent: 'center',
                    alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(5px)'
                }}>
                    <div style={{
                        backgroundColor: '#1a1a1a', borderRadius: '10px', padding: '30px',
                        width: '90%', maxWidth: '500px', boxShadow: '0 8px 30px rgba(0, 0, 0, 0.7)',
                        border: '1px solid #333', textAlign: 'left', position: 'relative',
                        animation: 'fadeIn 0.3s ease-out'
                    }}>
                        <button
                            onClick={() => setShowTokenInfoPopup(false)}
                            style={{
                                position: 'absolute', top: '15px', right: '15px',
                                background: 'none', border: 'none', color: '#aaa',
                                cursor: 'pointer', fontSize: '24px', lineHeight: '1',
                                transition: 'color 0.2s ease'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.color = '#fff'}
                            onMouseOut={(e) => e.currentTarget.style.color = '#aaa'}
                        >
                            <X size={24} />
                        </button>

                        <h2 style={{ color: '#fff', marginBottom: '20px', fontSize: '1.8rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Info size={28} style={{ marginRight: '10px', color: '#00FFFF' }} /> Token Information
                        </h2>

                        <p style={{ color: '#ccc', marginBottom: '20px', fontSize: '1rem', lineHeight: '1.6' }}>
                            To obtain a token for accessing this application, please contact the owner via Discord (Username: <span style={{ color: '#7289DA', fontWeight: 'bold' }}>GalaxyKickLock</span>).
                            <img src="/discord-icon.svg" alt="Discord Icon" style={{ width: '18px', height: '18px', marginLeft: '8px', verticalAlign: 'middle' }} />
                        </p>

                        <div style={{ borderTop: '1px solid #333', paddingTop: '20px', marginTop: '20px' }}>
                            <h3 style={{ color: '#fff', marginBottom: '15px', fontSize: '1.4rem', display: 'flex', alignItems: 'center' }}>
                                <DollarSign size={22} style={{ marginRight: '8px', color: '#22c55e' }} /> Token Pricing:
                            </h3>
                            <ul style={{ listStyle: 'none', paddingLeft: '0', color: '#ccc', fontSize: '0.95rem' }}>
                                <li style={{ marginBottom: '8px' }}><strong>1. 3-Month Subscription</strong> – 300 Fire Cannon Balls per token</li>
                                <li style={{ marginBottom: '8px' }}><strong>2. 6-Month Subscription</strong> – 600 Fire Cannon Balls per token</li>
                                <li style={{ marginBottom: '8px' }}><strong>3. 1-Year Subscription</strong> – 1200 Fire Cannon Balls per token</li>
                            </ul>
                            <p style={{ color: '#f39c12', fontSize: '0.85rem', fontStyle: 'italic', marginTop: '10px' }}>
                                <strong>Note:</strong> Pricing is fixed and non-negotiable.
                            </p>
                        </div>

                        <div style={{ borderTop: '1px solid #333', paddingTop: '20px', marginTop: '20px' }}>
                            <h3 style={{ color: '#fff', marginBottom: '15px', fontSize: '1.4rem', display: 'flex', alignItems: 'center' }}>
                                <FileText size={22} style={{ marginRight: '8px', color: '#3498db' }} /> Terms & Conditions:
                            </h3>
                            <ul style={{ listStyle: 'none', paddingLeft: '0', color: '#ccc', fontSize: '0.95rem' }}>
                                <li style={{ marginBottom: '8px' }}>1. Token pricing may change based on application demand or usage trends.</li>
                                <li style={{ marginBottom: '8px' }}>2. Tokens will be issued <em>only</em> upon successful transfer of Fire Cannon Balls to the owner's account.</li>
                                <li style={{ marginBottom: '8px' }}>3. Customers will receive the latest application updates by default, subject to future changes.</li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
