"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseAnonKey!);

const STORAGE_KEYS = {
    SESSION_TOKEN: 'sessionToken',
    USER_ID: 'userId',
    USERNAME: 'username',
    SESSION_ID: 'sessionId'
} as const;

export default function SignInPage() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const sessionChannel = useRef<any>(null);

    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'error') => { // Added 'info' type
        toast[type](message, {
            position: "top-right",
            autoClose: type === 'info' ? 7000 : 3000, // Longer for info messages
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            theme: "dark"
        });
    };

    // generateSessionToken and generateSessionId are now backend responsibilities.

    const clearSessionStorage = () => {
        Object.values(STORAGE_KEYS).forEach(key => sessionStorage.removeItem(key));
    };

    interface SessionData {
        userId: string | null;
        sessionToken: string | null;
        username: string | null;
        sessionId: string | null;
    }

    const getSessionData = (): SessionData => ({
        userId: sessionStorage.getItem(STORAGE_KEYS.USER_ID),
        sessionToken: sessionStorage.getItem(STORAGE_KEYS.SESSION_TOKEN),
        username: sessionStorage.getItem(STORAGE_KEYS.USERNAME),
        sessionId: sessionStorage.getItem(STORAGE_KEYS.SESSION_ID)
    });

    const handleSessionTermination = async (message: string = "Your session has ended.") => {
        const sessionData = getSessionData(); // Gets { userId, sessionToken, username, sessionId }
        
        if (sessionData.userId && sessionData.sessionToken && sessionData.sessionId) {
            try {
                const headers: Record<string, string> = {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionData.sessionToken}`,
                    'X-User-ID': sessionData.userId,
                    'X-Session-ID': sessionData.sessionId,
                };

                const response = await fetch('/api/auth/signout', {
                    method: 'POST',
                    headers: headers,
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ message: "Sign out failed on server." }));
                    showToast(errorData.message || "Could not sign out session on server.");
                    // We still proceed to clear local session and redirect.
                } else {
                    console.log("Server sign out successful.");
                }
            } catch (error) {
                console.error("Error calling signout API:", error);
                showToast("Failed to communicate with server for sign out.");
                // We still proceed to clear local session and redirect.
            }
        } else {
            console.log("No local session data to terminate on server, clearing client.");
        }

        // Always clear local storage and redirect
        clearSessionStorage();
        router.push("/"); // Or perhaps to '/signin' if that's the desired redirect on logout
        showToast(message);
    };

    useEffect(() => {
        const setupSessionManagement = async () => {
            const userId = sessionStorage.getItem(STORAGE_KEYS.USER_ID);
            if (userId) {
                sessionChannel.current = supabase
                    .channel('session_updates')
                    .on('broadcast', { event: 'session_terminated' }, async (payload) => {
                        if (payload.userId === parseInt(userId)) {
                            await handleSessionTermination("Your session was ended due to a new login.");
                        }
                    })
                    .subscribe();
            }
        };

        setupSessionManagement();

        return () => {
            if (sessionChannel.current) {
                sessionChannel.current.unsubscribe();
            }
        };
    }, [router]);

    const validateInputs = () => {
        if (!username.trim() || !password.trim()) {
            showToast("Username and password are required");
            return false;
        }
        if (password.length < 8) {
            showToast("Password must be at least 8 characters");
            return false;
        }
        return true;
    };

    // authenticateUser and updateUserSession logic moved to /api/auth/signin

    const storeSessionData = (sessionToken: string, userId: string, username: string, sessionId: string) => {
        sessionStorage.setItem(STORAGE_KEYS.SESSION_TOKEN, sessionToken);
        sessionStorage.setItem(STORAGE_KEYS.USER_ID, userId);
        sessionStorage.setItem(STORAGE_KEYS.USERNAME, username);
        sessionStorage.setItem(STORAGE_KEYS.SESSION_ID, sessionId);
    };

    const completeLoginFlow = () => {
        router.push("/profile?username=" + encodeURIComponent(username));
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (isLoading) return;
        
        setIsLoading(true);
        let longLoginTimerId: NodeJS.Timeout | null = null;

        // Set a timer to show a more specific message if login takes too long
        longLoginTimerId = setTimeout(() => {
            showToast("Finalizing previous session, this may take a bit longer. Please wait...", 'info');
        }, 7000); // Show after 7 seconds if still loading

        try {
            if (!validateInputs()) {
                if (longLoginTimerId) clearTimeout(longLoginTimerId);
                setIsLoading(false);
                return;
            }

            const response = await fetch('/api/auth/signin', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });
            
            if (longLoginTimerId) clearTimeout(longLoginTimerId); // Clear timer as fetch has completed

            const data = await response.json();

            if (response.ok) {
                // sessionStorage.setItem(STORAGE_KEYS.USERNAME, data.username); // Store username if needed
                showToast(data.message || "Successfully signed in!", 'success');
                setTimeout(() => {
                    completeLoginFlow(); 
                }, 1000);
            } else {
                if (response.status === 409) {
                    // Server indicates undeploy issue (timeout or failure)
                    showToast(data.message || "Previous session cleanup encountered an issue. Please try signing in again.", 'error');
                } else {
                    showToast(data.message || "Sign in failed. Please try again.", 'error');
                }
            }
        } catch (error) {
            if (longLoginTimerId) clearTimeout(longLoginTimerId);
            console.error("Sign in error:", error);
            showToast("An error occurred during sign in. Please check your connection.");
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

                    <button
                        type="submit"
                        className="welcome-button w-full mt-6"
                        disabled={isLoading}
                    >
                        {isLoading ? "Signing in..." : "Sign In"}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <Link href="/signup" className="text-primary-color hover:text-secondary-color transition-colors">
                        Don't have an account? Sign up
                    </Link>
                </div>
            </div>
        </div>
    );
}
