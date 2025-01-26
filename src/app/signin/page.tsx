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

    const handleSessionTermination = async (message: string = "Your session has ended.") => {
        try {
            const userId = sessionStorage.getItem(STORAGE_KEYS.USER_ID);
            if (userId) {
                console.log("Terminating session for user:", userId);
                Object.values(STORAGE_KEYS).forEach(key => {
                    sessionStorage.removeItem(key);
                    console.log("Removed key from session storage:", key);
                });

                await supabase
                    .from("users")
                    .update({
                        session_token: null,
                        active_session_id: null,
                        last_logout: new Date().toISOString()
                    })
                    .eq("id", userId);
            }
        } catch (error) {
            console.error("Error in session termination:", error);
        } finally {
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
                        console.log("Received session termination broadcast for user:", payload.userId);
                        if (payload.userId === parseInt(userId)) {
                            await handleSessionTermination("Your session was ended due to a new login.");
                        }
                    })
                    .subscribe((status) => {
                        console.log("Subscription status:", status);
                    });
            }
        };

        setupSessionManagement();

        return () => {
            if (sessionChannel.current) {
                sessionChannel.current.unsubscribe();
            }
        };
    }, [router]);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        
        if (isLoading) return;
        setIsLoading(true);

        try {
            if (!username.trim() || !password.trim()) {
                showToast("Please enter both username and password");
                setIsLoading(false);
                return;
            }

            if (!supabase) {
                throw new Error("Supabase client is not initialized.");
            }

            const { data: user, error: userError } = await supabase
                .from("users")
                .select("*")
                .eq("username", username)
                .single();

            if (userError || !user) {
                showToast("Invalid credentials");
                setIsLoading(false);
                return;
            }

            if (user.password !== password) {
                showToast("Invalid credentials");
                setIsLoading(false);
                return;
            }

            const newSessionToken = generateSessionToken();
            const newSessionId = generateSessionId();

            console.log("Creating new session for user:", user.id);
            console.log("New session ID:", newSessionId);

            if (user.active_session_id) {
                console.log("Terminating existing session for user:", user.id);
                const { error: terminateError } = await supabase
                    .from("users")
                    .update({
                        session_token: null,
                        active_session_id: null,
                        last_logout: new Date().toISOString()
                    })
                    .eq("id", user.id);

                if (terminateError) {
                    throw new Error("Failed to terminate existing session.");
                }

                await supabase
                    .channel('session_updates')
                    .send({
                        type: 'broadcast',
                        event: 'session_terminated',
                        payload: { userId: user.id }
                    });

                console.log("Broadcasted session termination for user:", user.id);

                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            const { error: updateError } = await supabase
                .from("users")
                .update({
                    session_token: newSessionToken,
                    active_session_id: newSessionId,
                    last_login: new Date().toISOString(),
                    login_count: (user.login_count || 0) + 1
                })
                .eq("id", user.id);

            if (updateError) {
                throw new Error("Failed to create session.");
            }

            sessionStorage.setItem(STORAGE_KEYS.SESSION_TOKEN, newSessionToken);
            sessionStorage.setItem(STORAGE_KEYS.USER_ID, user.id.toString());
            sessionStorage.setItem(STORAGE_KEYS.USERNAME, username);
            sessionStorage.setItem(STORAGE_KEYS.SESSION_ID, newSessionId);

            console.log("Session data saved in sessionStorage");

            setUsername("");
            setPassword("");
            showToast("Sign in successful!");
            router.push(`/profile?username=${encodeURIComponent(username)}`);
        } catch (error) {
            if (error instanceof Error) {
            showToast("An error occurred during sign in. Please try again.");
            }
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