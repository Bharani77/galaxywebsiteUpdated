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

    const generateSessionToken = (): string => {
        const buffer = new Uint8Array(32);
        crypto.getRandomValues(buffer);
        return Array.from(buffer)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('') + Date.now().toString(36);
    };

    const generateSessionId = (): string => {
        return crypto.randomUUID();
    };

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
        const { userId } = getSessionData();
        if (!userId) return;

        try {
            const { error } = await supabase
                .from("users")
                .update({
                    session_token: null,
                    active_session_id: null,
                    last_logout: new Date().toISOString()
                })
                .eq("id", userId);

            if (error) throw error;
            
            await supabase
                .channel('session_updates')
                .send({
                    type: 'broadcast',
                    event: 'session_terminated',
                    payload: { userId: parseInt(userId) }
                });
        } catch (error) {
            console.error("Session termination error:", error);
            showToast("Failed to properly end session. Please clear browser data.");
        } finally {
            clearSessionStorage();
            router.push("/");
            showToast(message);
        }
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

    const authenticateUser = async () => {
        try {
            console.log('Attempting login with username:', username);

            const { data: user, error } = await supabase
                    .from("users")
                .select("id, username, password, active_session_id, login_count")
                .eq("username", username)
                .single();

            if (error) {
                console.error('Database error:', error);
                showToast("Invalid credentials");
                return null;
            }

            if (!user) {
                console.log('No user found with username:', username);
                showToast("Invalid credentials");
                return null;
            }

            if (user.password !== password) {
                console.log('Password mismatch');
                showToast("Invalid credentials");
                return null;
            }
            return user;
        } catch (error) {
            console.error('Authentication error:', error);
            showToast("An error occurred during authentication");
            return null;
        }
    };

    const updateUserSession = async (userId: string, sessionToken: string, sessionId: string, loginCount: number) => {
        const { error } = await supabase
            .from("users")
            .update({
                session_token: sessionToken,
                active_session_id: sessionId,
                login_count: loginCount + 1,
                last_login: new Date().toISOString()
            })
            .eq("id", userId);

        if (error) throw error;
    };

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
        try {
            if (!validateInputs()) return;

            const user = await authenticateUser();
            if (!user) return;

            const newSessionToken = generateSessionToken();
            const newSessionId = generateSessionId();

            if (user.active_session_id) {
                const { error: terminateError } = await supabase
                    .from("users")
                    .update({
                        session_token: null,
                        active_session_id: null,
                        last_logout: new Date().toISOString()
                    })
                    .eq("id", user.id);

                if (terminateError) throw new Error("Failed to terminate existing session.");

                await supabase
                    .channel('session_updates')
                    .send({
                        type: 'broadcast',
                        event: 'session_terminated',
                        payload: { userId: user.id }
                    });
            }

            await updateUserSession(user.id.toString(), newSessionToken, newSessionId, user.login_count);
            storeSessionData(newSessionToken, user.id.toString(), user.username, newSessionId);
            showToast("Successfully signed in!", 'success');
            setTimeout(() => {
                completeLoginFlow();
            }, 1000);
        } catch (error) {
            showToast("An error occurred during sign in");
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
