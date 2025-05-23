"use client";

import React, { useState } from "react"; // useEffect removed as sessionStorage logic is no longer needed
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { X, DollarSign, FileText, Info, MessageCircle } from 'lucide-react'; // Added MessageCircle for Discord representation

export default function SignUpPage() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [token, setToken] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [showTokenInfoPopup, setShowTokenInfoPopup] = useState(false);
    const router = useRouter();

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
                        <label className="block text-white text-sm font-semibold mb-2 text-left w-full" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span>Token</span>
                            <Info
                                size={16}
                                style={{ cursor: 'pointer', color: '#00FFFF', marginLeft: '5px' }}
                                onClick={() => setShowTokenInfoPopup(true)}
                            />
                        </label>
                        <input
                            type="text"
                            value={token}
                            onChange={(e) => setToken(e.target.value)}
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
                            <Info size={28} style={{ marginRight: '10px', color: '#00FFFF' }} /> Token Details
                        </h2>

                        <p style={{ color: '#ccc', marginBottom: '20px', fontSize: '1rem', lineHeight: '1.6' }}>
                            To get a token, contact the owner on Discord: <span style={{ color: '#7289DA', fontWeight: 'bold' }}>GalaxyKickLock</span>
                        </p>

                        <div style={{ borderTop: '1px solid #333', paddingTop: '20px', marginTop: '20px' }}>
                            <h3 style={{ color: '#fff', marginBottom: '15px', fontSize: '1.4rem', display: 'flex', alignItems: 'center' }}>
                                <DollarSign size={22} style={{ marginRight: '8px', color: '#22c55e' }} /> Pricing:
                            </h3>
                            <ul style={{ listStyle: 'none', paddingLeft: '0', color: '#ccc', fontSize: '0.95rem' }}>
                                <li style={{ marginBottom: '8px' }}>✨ 3-Month: 300 Fire Cannon Balls</li>
                                <li style={{ marginBottom: '8px' }}>🌟 6-Month: 600 Fire Cannon Balls</li>
                                <li style={{ marginBottom: '8px' }}>💎 1-Year: 1200 Fire Cannon Balls</li>
                            </ul>
                            <p style={{ color: '#f39c12', fontSize: '0.85rem', fontStyle: 'italic', marginTop: '10px' }}>
                                ⚠️ Prices are fixed and non-negotiable.
                            </p>
                        </div>

                        <div style={{ borderTop: '1px solid #333', paddingTop: '20px', marginTop: '20px' }}>
                            <h3 style={{ color: '#fff', marginBottom: '15px', fontSize: '1.4rem', display: 'flex', alignItems: 'center' }}>
                                <FileText size={22} style={{ marginRight: '8px', color: '#3498db' }} /> Terms:
                            </h3>
                            <ul style={{ listStyle: 'none', paddingLeft: '0', color: '#ccc', fontSize: '0.95rem' }}>
                                <li style={{ marginBottom: '8px' }}>1. Prices may change based on demand.</li>
                                <li style={{ marginBottom: '8px' }}>2. Tokens issued ONLY after successful transfer of Fire Cannon Balls to the owner's account.</li>
                                <li style={{ marginBottom: '8px' }}>3. Latest app updates included by default. * Subject to future change</li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
