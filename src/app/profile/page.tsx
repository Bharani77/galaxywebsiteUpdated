"use client";

import { useSearchParams, useRouter } from "next/navigation";
import React, { Suspense, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseAnonKey!);

function ProfileContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const username = searchParams.get("username");

    const validateSession = async () => {
        const userId = sessionStorage.getItem("userId");
        const sessionId = sessionStorage.getItem("sessionId");

        if (!userId || !sessionId) {
            // Check if there's an active session in DB
            const { data: user, error } = await supabase
                .from("users")
                .select("active_session_id")
                .eq("username", username)
                .single();

            if (user && user.active_session_id) {
                // Active session exists in another tab
                await supabase.rpc('terminate_session', { user_id: user.id });
                sessionStorage.clear();
                toast.error('Duplicate session detected. Multiple tabs are not allowed.', {
                    onClose: () => router.push('/signin')
                });
            } else {
                // No active session anywhere
                sessionStorage.clear();
                toast.warning('Session expired. Please sign in again.', {
                    onClose: () => router.push('/signin')
                });
            }
            return;
        }

        // Query the database to check if the session is still valid
        const { data: user, error } = await supabase
            .from("users")
            .select("active_session_id")
            .eq("id", userId)
            .single();

        if (error || !user || user.active_session_id !== sessionId) {
            // Session is no longer valid, terminate it
            sessionStorage.clear();
            toast.error('Session invalid. Please sign in again.', {
                onClose: () => router.push('/signin')
            });
        }
    };

    useEffect(() => {
        // Initial session validation
        validateSession();

        // Validate session every 10 seconds
        const interval = setInterval(validateSession, 10000);

        // Listen for real-time updates to the user's session
        const userId = sessionStorage.getItem("userId");
        if (userId) {
            const channel = supabase
                .channel("session-updates")
                .on(
                    "broadcast",
                    { event: "session_terminated" },
                    (payload) => {
                        if (payload.userId === parseInt(userId)) {
                            sessionStorage.clear();
                            toast.error('Your session was terminated.', {
                                onClose: () => router.push('/signin')
                            });
                        }
                    }
                )
                .subscribe();

            return () => {
                clearInterval(interval);
                channel.unsubscribe();
            };
        } else {
            clearInterval(interval);
        }
    }, [router, username]);

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-violet-600 flex flex-col items-center justify-center p-4">
            <ToastContainer
                position="top-right"
                autoClose={3000}
                hideProgressBar={false}
                newestOnTop={false}
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme="light"
            />
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 shadow-lg max-w-md w-full">
                <h1 className="text-2xl font-bold text-white mb-4">
                    Hello,{" "}
                    <span className="text-purple-300">
                        {username ? username : "Guest"}
                    </span>
                    !
                </h1>
                {/* Add other content or components here */}
            </div>
        </div>
    );
}

export default function ProfilePage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-violet-600 flex items-center justify-center">
                <div className="text-white text-xl">Loading...</div>
            </div>
        }>
            <ProfileContent />
        </Suspense>
    );
}
