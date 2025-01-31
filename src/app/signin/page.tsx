"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

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
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const sessionChannel = useRef<any>(null);

    const showToast = (message: string, duration: number = 3000) => {
        setToastMessage(message);
        setTimeout(() => setToastMessage(null), duration);
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
            completeLoginFlow();
        }  catch (error: unknown) {
            console.error('Sign in error:', error);
            showToast("An error occurred during sign in. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-violet-600 flex items-center justify-center p-4">
            <div className="bg-gray-800/50 backdrop-blur-lg p-8 rounded-xl shadow-xl max-w-md w-full">
                <h1 className="text-3xl font-bold text-white text-center mb-8">
                    Galaxy KickLock SignIn
                </h1>
                
                {toastMessage && (
                    <div className="mb-4 p-3 bg-blue-500/20 text-white rounded-lg text-center">
                        {toastMessage}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-white mb-2">Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter username"
                            disabled={isLoading}
                        />
                    </div>

                    <div>
                        <label className="block text-white mb-2">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter password"
                            disabled={isLoading}
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition duration-200 disabled:opacity-50"
                        disabled={isLoading}
                    >
                        {isLoading ? "Signing in..." : "Sign In"}
                    </button>
                </form>
            </div>
        </div>
    );
}
