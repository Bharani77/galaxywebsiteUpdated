"use client"; // Add this line at the top of the file

// import { createClient } from '@supabase/supabase-js'; // No longer needed directly in this component
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

// const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!; // Handled by backend routes
// const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!; // Handled by backend routes
// const supabase = createClient(supabaseUrl, supabaseAnonKey); // Client-side Supabase instance removed

// Add admin storage keys
const ADMIN_STORAGE_KEYS = {
    ADMIN_ID: 'adminId',
    ADMIN_USERNAME: 'adminUsername',
    ADMIN_SESSION_ID: 'adminSessionId'
};

interface TokenUser {
    token: string;
    duration: string;
    createdat: string;
    expiresat: string | null;
    username: string;
    userId: string | null;
}

import { X } from 'lucide-react';
export default function AdminDashboardPage() {
    const router = useRouter();
    
    // Add state for admin name
    const [adminName, setAdminName] = useState<string>('');
    
    // Add logout function
    const handleLogout = async () => {
        // Clear any client-side admin session remnants (though primary is cookie)
        Object.values(ADMIN_STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
        localStorage.setItem('admin_logout_event', Date.now().toString()); // For other tabs

        // Call a backend API to invalidate admin cookies, if you create one.
        // For now, just redirecting. The cookies will expire based on their maxAge.
        // Or, if you have an /api/admin/auth/signout that clears admin cookies:
        try {
            // Assuming you might create an /api/admin/auth/signout endpoint
            // that clears 'adminSessionId', 'adminId', 'adminUsername' cookies.
            // If not, this fetch call is illustrative.
            await fetch('/api/admin/auth/signout', { method: 'POST' });
        } catch (e) {
            console.error("Error calling admin signout API:", e);
        }
        
        router.push('/admin');
    };
    
    const [tokens, setTokens] = useState<{ [key: string]: string }>({
        '3month': '',
        '6month': '',
        '1year': '',
    });
    
    const [isLoading, setIsLoading] = useState<{ [key: string]: boolean }>({
        '3month': false,
        '6month': false,
        '1year': false,
    });
    
    const [isDeletingToken, setIsDeletingToken] = useState<{ [key: string]: { [tokenId: string]: boolean } }>({
        '3month': {},
        '6month': {},
        '1year': {},
    });
    
    const [tokenHistory, setTokenHistory] = useState<{ [key: string]: { token: string; status: string; id: string }[] }>({
        '3month': [],
        '6month': [],
        '1year': [],
    });
    
    const [tokenUsers, setTokenUsers] = useState<TokenUser[]>([]);
    const [isRenewModalOpen, setIsRenewModalOpen] = useState<boolean>(false);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [selectedDuration, setSelectedDuration] = useState<string>('3month');
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
    const [selectedUserForDelete, setSelectedUserForDelete] = useState<{ userId: string; token: string } | null>(null);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    const getAdminApiAuthHeaders = (): Record<string, string> => {
        // HTTP-only cookies are sent automatically by the browser.
        // Backend API routes protected by middleware or using validateAdminSession
        // will have access to session details via these cookies.
        // No need to manually set X-Admin-ID, X-Admin-Username, X-Admin-Session-ID from localStorage.
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        // The console.warn for missing localStorage items can be removed.
        // console.log('getAdminApiAuthHeaders: Relying on HttpOnly cookies for admin session auth.');
        return headers;
    };
    
    // Add effect to get admin name from localStorage
    useEffect(() => {
        // const username = localStorage.getItem(ADMIN_STORAGE_KEYS.ADMIN_USERNAME); // This will no longer work reliably as cookies are HttpOnly
        // For now, let's remove setting adminName from localStorage.
        // A proper solution would be to get it from the server during session validation if needed for display.
        // Or, the /api/admin/auth/signin could return it in the body (which it does)
        // and the login page could pass it via router query or a short-lived client-side state store (not localStorage for session details).
        // For simplicity, we can try to read the 'adminUsername' cookie if it's accessible (i.e., not HttpOnly, which it is).
        // The most robust way is server-side rendering or an API call to fetch user details if needed.
        // For now, we'll leave adminName potentially blank or find another way.
        // One simple way: if the signin API returns username in body, the login page can pass it as a query param.
        // However, the signin API already sets an 'adminUsername' cookie. If it's not HttpOnly, it can be read.
        // Let's assume for now the display of adminName might not work or needs a different approach.
        // We will remove the direct localStorage read here.
        // setAdminName(''); // Or fetch from a different source if available
    }, []);
    
    // Add listener for logout events from other tabs
    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'admin_logout_event') {
                // Another tab triggered logout, redirect to login page
                router.push('/admin');
            }
        };
        
        window.addEventListener('storage', handleStorageChange);
        
        return () => {
            window.removeEventListener('storage', handleStorageChange);
        };
    }, [router]);
    
    const MAX_HISTORY_LENGTH = 5;
    
    // Show toast message
    const showToast = (message: string) => {
        setToastMessage(message);
        setTimeout(() => setToastMessage(null), 3000); // Hide toast after 3 seconds
    };

    // Function to copy token to clipboard
    const copyTokenToClipboard = (token: string) => {
        navigator.clipboard.writeText(token).then(() => {
            showToast('Token copied to clipboard!');
        });
    };

    // Function to update active tokens from history
    const updateActiveTokens = (history: typeof tokenHistory) => {
        const newTokens: { [key: string]: string } = {
            '3month': '',
            '6month': '',
            '1year': '',
        };

        Object.entries(history).forEach(([duration, tokens]) => {
            const activeToken = tokens.find((t) => t.status === 'Active');
            if (activeToken) {
                newTokens[duration] = activeToken.token;
            }
        });

        setTokens(newTokens);
    };

    // Function to generate a token
    const generateToken = async (duration: string) => {
        setIsLoading((prev) => ({ ...prev, [duration]: true }));

        try {
            const authHeaders = getAdminApiAuthHeaders(); // This now only sets Content-Type
            // The check for !authHeaders['X-Admin-ID'] is no longer relevant here,
            // as authentication is handled by cookies verified by the middleware/backend.
            // If the API call is made, we assume the middleware has validated the session.

            const response = await fetch('/api/admin/tokens', {
                method: 'POST',
                headers: authHeaders,
                body: JSON.stringify({ duration }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: "Failed to generate token" }));
                throw new Error(errorData.message || `HTTP error ${response.status}`);
            }

            const insertedData = await response.json(); // This is the new token object from the backend

            if (insertedData && insertedData.token && insertedData.id) {
                // Update token history with the new token
                const updatedHistory = {
                    ...tokenHistory,
                    [duration]: [
                        { token: insertedData.token, status: insertedData.status || 'Active', id: insertedData.id },
                        ...(tokenHistory[duration].length >= MAX_HISTORY_LENGTH
                            ? tokenHistory[duration].slice(0, MAX_HISTORY_LENGTH - 1)
                            : tokenHistory[duration]),
                    ],
                };

                setTokenHistory(updatedHistory);
                updateActiveTokens(updatedHistory); // This will update the displayed active token

                showToast('Token generated successfully!');
                setIsLoading((prev) => {
                    const newState = { ...prev };
                    newState[duration] = false;
                    return newState;
                });
            } else {
                showToast('Error: Invalid data received from server after token generation.');
            }
        } catch (error) {
            let errorMessage = 'Unknown error occurred';
            if (error instanceof Error) {
                errorMessage = error.message;
            } else if (typeof error === 'object' && error !== null) {
                errorMessage = JSON.stringify(error);
            }
            console.error('Error in generateToken:', error);
            showToast(`Error: ${errorMessage}`);
        }
        // Remove the finally block and move setIsLoading(false) to after the UI updates
        setIsLoading((prev) => {
            const newState = { ...prev };
            newState[duration] = false;
            return newState;
        });
    };

    // Function to delete a token
    const handleDeleteToken = async (tokenId: string, duration: string) => {
        if (!tokenId) {
            console.error('Token ID is undefined. Cannot delete.');
            showToast('Error deleting token: Token ID is missing.');
            return;
        }

        setIsDeletingToken((prev) => ({ ...prev, [duration]: { ...prev[duration], [tokenId]: true } }));

        try {
            const authHeaders = getAdminApiAuthHeaders(); // Only Content-Type
            // Auth check removed, relying on middleware.

            const response = await fetch(`/api/admin/tokens?tokenId=${tokenId}`, {
                method: 'DELETE',
                headers: authHeaders,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: "Failed to delete token" }));
                throw new Error(errorData.message || `HTTP error ${response.status}`);
            }

            // Token deleted successfully on backend, now update UI
            showToast('Token deleted successfully from server!');
            
            // Update the token history locally
            const updatedHistory = {
                ...tokenHistory,
                [duration]: tokenHistory[duration].filter((item) => item.id !== tokenId),
            };

            setTokenHistory(updatedHistory);
            updateActiveTokens(updatedHistory);

            // Refresh the token user details
            fetchTokenUserDetails();
        } catch (error) {
            let errorMessage = 'Unknown error occurred';
            if (error instanceof Error) {
                errorMessage = error.message;
            } else if (typeof error === 'object' && error !== null) {
                errorMessage = JSON.stringify(error);
            }
            console.error('Error during token deletion:', error);
            showToast(`Error deleting token: ${errorMessage}`);
        } finally {
            setIsDeletingToken((prev) => ({ ...prev, [duration]: { ...prev[duration], [tokenId]: false } }));
        }
    };

    // Function to delete a user and associated token
    const handleDeleteUser = async (userId: string, token: string) => {
        if (!userId || !token) {
            console.error('User ID or Token is missing.');
            showToast('Error: User ID or Token is missing.');
            return;
        }

        try {
            const authHeaders = getAdminApiAuthHeaders(); // Only Content-Type
            // Auth check removed, relying on middleware.

            const response = await fetch(`/api/admin/users?userId=${userId}&token=${token}`, {
                method: 'DELETE',
                headers: authHeaders,
            });

            const responseData = await response.json();

            if (!response.ok) {
                throw new Error(responseData.message || `HTTP error ${response.status}`);
            }
            
            showToast(responseData.message || 'User and associated token deleted successfully!');

            // Update the token history by removing the deleted token (token value is in `token` variable)
            const updatedHistory = { ...tokenHistory };
            Object.keys(updatedHistory).forEach((duration) => {
                updatedHistory[duration] = updatedHistory[duration].filter((item) => item.token !== token);
            });

            setTokenHistory(updatedHistory);
            updateActiveTokens(updatedHistory);

            // Refresh the token user details
            fetchTokenUserDetails();
        } catch (error) {
            let errorMessage = 'Unknown error occurred';
            if (error instanceof Error) {
                errorMessage = error.message;
            } else if (typeof error === 'object' && error !== null) {
                errorMessage = JSON.stringify(error);
            }
            console.error('Error in handleDeleteUser:', errorMessage);
            showToast(`Error: ${errorMessage}`);
        }
    };

    // Function to open the delete confirmation modal
    const openDeleteModal = (userId: string, token: string) => {
        setSelectedUserForDelete({ userId, token });
        setIsDeleteModalOpen(true);
    };

    // Function to close the delete confirmation modal
    const closeDeleteModal = () => {
        setIsDeleteModalOpen(false);
        setSelectedUserForDelete(null);
    };

    // Function to handle delete action (token or user)
    const handleDeleteAction = async (action: 'token' | 'user') => {
        if (!selectedUserForDelete) return;

        const { userId, token } = selectedUserForDelete;

        if (action === 'token') {
            try {
                const authHeaders = getAdminApiAuthHeaders(); // Only Content-Type
                // Auth check removed, relying on middleware.

                const response = await fetch(`/api/admin/user-token-link?userId=${userId}&token=${token}`, {
                    method: 'DELETE',
                    headers: authHeaders,
                });

                const responseData = await response.json();

                if (!response.ok) {
                    throw new Error(responseData.message || `HTTP error ${response.status}`);
                }
                
                showToast(responseData.message || 'Token link removed successfully!');

                // Update the token history locally
                const updatedHistory = { ...tokenHistory };
                Object.keys(updatedHistory).forEach((duration) => {
                    updatedHistory[duration] = updatedHistory[duration].filter((item) => item.token !== token);
                });
                setTokenHistory(updatedHistory);

                // Update the active tokens
                updateActiveTokens(updatedHistory);

                showToast('Token deleted successfully!');
                fetchTokenUserDetails(); // Refresh the token user details
            } catch (error) {
                console.error('Error deleting token:', error);
                showToast('Error deleting token');
            }
        } else if (action === 'user') {
            // Delete the user and their InUse token
            handleDeleteUser(userId, token);
        }

        closeDeleteModal();
    };

    // Function to open the renew modal
    const openRenewModal = (userId: string) => {
        setSelectedUserId(userId);
        setIsRenewModalOpen(true);
    };

    // Function to close the renew modal
    const closeRenewModal = () => {
        setIsRenewModalOpen(false);
        setSelectedUserId(null);
        setSelectedDuration('3month');
    };

    // Function to renew a token
    const handleRenewToken = async () => {
        if (!selectedUserId) {
            console.error('User ID is missing.');
            showToast('Error: User ID is missing.');
            return;
        }

        try {
            const authHeaders = getAdminApiAuthHeaders(); // Only Content-Type
            // Auth check removed, relying on middleware.

            const response = await fetch('/api/admin/renew-token', {
                method: 'POST',
                headers: authHeaders,
                body: JSON.stringify({ userId: selectedUserId, duration: selectedDuration }),
            });

            const responseData = await response.json();

            if (!response.ok) {
                throw new Error(responseData.message || `HTTP error ${response.status}`);
            }
            
            showToast(responseData.message || 'Token renewed successfully!');
            // Refresh the token user details and token history
            fetchTokenUserDetails();
            fetchTokenHistory(); // fetchTokenHistory was already useCallback, so it's fine to call
            closeRenewModal();

        } catch (error) {
            let errorMessage = 'Unknown error occurred';
            if (error instanceof Error) {
                errorMessage = error.message;
            } else if (typeof error === 'object' && error !== null) {
                errorMessage = JSON.stringify(error);
            }
            console.error('Error renewing token:', errorMessage);
            showToast(`Error renewing token: ${errorMessage}`);
        }
    };

    // Fetch token history on component mount
    const fetchTokenHistory = useCallback(async () => {
        try {
            const authHeaders = getAdminApiAuthHeaders(); // Only Content-Type
            // Auth check removed, relying on middleware.

            const response = await fetch('/api/admin/token-history', {
                method: 'GET',
                headers: authHeaders,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: "Failed to fetch token history" }));
                throw new Error(errorData.message || `HTTP error ${response.status}`);
            }

            const data: any[] = await response.json(); // Data is an array of token objects

            const history: typeof tokenHistory = {
                '3month': [],
                '6month': [],
                '1year': [],
            };

            data.forEach((item) => {
                if (history[item.duration]) {
                    history[item.duration].push({
                        token: item.token,
                        status: item.status,
                        id: item.id,
                    });
                }
            });

            setTokenHistory(history);
            updateActiveTokens(history); // Update active tokens when history is fetched
        } catch (error) {
            let errorMessage = 'Unknown error occurred';
            if (error instanceof Error) {
                errorMessage = error.message;
            } else if (typeof error === 'object' && error !== null) {
                errorMessage = JSON.stringify(error);
            }
            console.error('Error fetching token history:', errorMessage);
        }
    }, []);

    // Fetch token user details on component mount
    const fetchTokenUserDetails = async () => {
        try {
            const authHeaders = getAdminApiAuthHeaders(); // Only Content-Type
            // Auth check removed, relying on middleware.
            // The middleware should prevent this page from loading if not authenticated.
            // If an API call fails with 401, that would indicate a session issue.

            const response = await fetch('/api/admin/token-user-details', {
                method: 'GET',
                headers: authHeaders,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: "Failed to fetch token user details" }));
                throw new Error(errorData.message || `HTTP error ${response.status}`);
            }

            const data: TokenUser[] = await response.json();
            setTokenUsers(data);

        } catch (error) {
            let errorMessage = 'Unknown error occurred';
            if (error instanceof Error) {
                errorMessage = error.message;
            } else if (typeof error === 'object' && error !== null) {
                errorMessage = JSON.stringify(error);
            }
            console.error('Error fetching token user details:', errorMessage);
        }
    };

    useEffect(() => {
        fetchTokenUserDetails();
        fetchTokenHistory();
    }, [fetchTokenHistory]);

    // Function to format date
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
        });
    };

    // Function to check if a token is expired
    const isTokenExpired = (expiresAt: string) => {
        const currentDate = new Date();
        const expiryDate = new Date(expiresAt);
        return currentDate > expiryDate;
    };

    // Function to get token status
    const getTokenStatus = (token: string, expiresAt: string | null) => {
        if (token === 'N/A' || expiresAt === null) {
            return 'N/A';
        } else if (isTokenExpired(expiresAt)) {
            return 'Expired';
        } else {
            return 'InUse';
        }
    };

    return (
        <div className="min-h-screen" style={{ backgroundColor: '#1a1a1a', color: 'white', padding: '1rem' }}>
            <div className="max-w-7xl mx-auto">
                {/* Add logout button at the top */}
                <div className="flex justify-between mb-4 items-center">
                    <div className="text-xl font-semibold" >
                        Welcome, {adminName || 'Admin'}
                    </div>
                    <button
                        onClick={handleLogout}
                        className="text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline hover:bg-green-700"
                        style={{ backgroundColor: '#22c55e' }}
                    >
                        Logout
                    </button>
                </div>
                
                <h2 className="text-2xl font-bold mb-6 text-center">Admin Dashboard - Token Generator</h2>

                {/* Toast Notification */}
                {toastMessage && (
                    <div style={{ position: 'fixed', top: '20px', right: '20px', backgroundColor: '#f87171', color: 'white', padding: '12px 20px', borderRadius: '6px', zIndex: 2000, display: 'flex', alignItems: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                        <span>{toastMessage}</span>
                        <button onClick={() => setToastMessage(null)} style={{ background: 'none', border: 'none', color: 'white', marginLeft: '15px', cursor: 'pointer', fontSize: '18px', lineHeight: '1' }}>
                            <X size={20} />
                        </button>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {Object.keys(tokens).map((duration) => (
                        <div key={duration} className="p-6 rounded-lg" style={{ backgroundColor: 'rgba(25, 0, 0, 0.7)' }}>
                            <h3 className="text-lg font-bold mb-4 text-center" style={{ color: '#FFFF00' }}>
                                {duration.charAt(0).toUpperCase() + duration.slice(1)} Token
                            </h3>
                            <div className="p-3 rounded mb-4 break-all flex items-center justify-between" style={{ backgroundColor: 'rgba(25, 0, 0, 0.7)' }}>
                                <span className="text-sm font-mono flex-1 truncate mr-2">
                                    {tokens[duration] ? tokens[duration] : 'No active token'}
                                </span>
                                <span className={`text-xs ${tokens[duration] ? 'text-green-500' : 'text-gray-400'}`}>
                                    {tokens[duration] ? 'Active' : ''}
                                </span>
                            </div>

                            <button
                                className={`w-full py-2 px-4 rounded font-semibold text-white ${
                                    isLoading[duration] ? 'cursor-not-allowed' : 'hover:bg-purple-700'
                                }`}
                                style={{ backgroundColor: isLoading[duration] ? '#555' : '#purple-600', color: 'white' }}
                                onClick={() => generateToken(duration)}
                                disabled={isLoading[duration]}
                            >
                                {isLoading[duration] ? 'Generating...' : 'Generate Token'}
                            </button>

                            {/* Token History */}
                            <div className="mt-4">
                                <h4 className="text-sm font-bold mb-2">Token History</h4>
                                <div className="max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-purple-600 scrollbar-track-gray-700 scrollbar-rounded">
                                    {tokenHistory[duration].map((item, index) => (
                                        <div key={index} className="p-2 rounded mb-2 text-sm flex justify-between items-center" style={{ backgroundColor: 'rgba(25, 0, 0, 0.7)' }}>
                                            <div className="flex-1 truncate mr-2">
                                                <span className="font-mono">{item.token}</span>
                                                <span className={`ml-2 ${item.status === 'Active' ? 'text-green-500' : item.status === 'InUse' ? 'text-red-500' : 'text-gray-400'}`}>
                                                    {item.status}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => copyTokenToClipboard(item.token)}
                                                        className="px-2 py-1 rounded text-white" style={{ color: 'white' }}
                                                    >
                                                        Copy
                                                </button>
                                                {item.status === 'Active' && (
                                                    <button
                                                        onClick={() => handleDeleteToken(item.id, duration)}
                                                        disabled={isDeletingToken[duration][item.id] || false}
                                                        className={`text-white hover:text-red-700 px-2 py-1 rounded ${
                                                           isDeletingToken[duration][item.id] ? 'opacity-50 cursor-not-allowed' : ''
                                                        }`} style={{ color: 'white' }}
                                                    >
                                                        {isDeletingToken[duration][item.id] ? 'Deleting...' : 'Delete'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Token User Details */}
                <div className="mt-8">
                    <h3 className="text-xl font-bold mb-4" style={{ color: '#FFFFFF' }}>Token User Details</h3>
                    <div className="p-6 rounded-lg overflow-x-auto" style={{ backgroundColor: 'rgba(25, 0, 0, 0.7)' }}>
                        <table className="w-full table-auto" style={{ border: '1px solid rgba(255, 0, 0, 0.3)' }}>
                            <thead>
                                <tr style={{ backgroundColor: 'rgba(25, 0, 0, 0.7)' }}>
                                    <th className="px-4 py-2 min-w-[200px] text-left">Token</th>
                                    <th className="px-4 py-2 min-w-[100px] text-left">Duration</th>
                                    <th className="px-4 py-2 min-w-[150px] text-left">Username</th>
                                    <th className="px-4 py-2 min-w-[200px] text-left">Created At</th>
                                    <th className="px-4 py-2 min-w-[200px] text-left">Expires At</th>
                                    <th className="px-4 py-2 min-w-[100px] text-left">Status</th>
                                    <th className="px-4 py-2 min-w-[100px] text-left">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tokenUsers.length > 0 ? (
                                    tokenUsers.map((user, index) => {
                                        const status = getTokenStatus(user.token, user.expiresat);
                                        return (
                                            <tr key={index} className={`text-sm hover:bg-gray-600`} style={{ backgroundColor: index % 2 === 0 ? 'rgba(25, 0, 0, 0.7)' : 'rgba(25, 0, 0, 0.7)' }}>
                                                <td className="px-4 py-2 break-all whitespace-nowrap">{user.token}</td>
                                                <td className="px-4 py-2 whitespace-nowrap">{user.duration}</td>
                                                <td className="px-4 py-2 whitespace-nowrap">{user.username}</td>
                                                <td className="px-4 py-2 whitespace-nowrap">{formatDate(user.createdat)}</td>
                                                <td className="px-4 py-2 whitespace-nowrap">
                                                    {user.expiresat ? formatDate(user.expiresat) : 'N/A'}
                                                </td>
                                                <td className="px-4 py-2 whitespace-nowrap">
                                                    <span
                                                        className={`px-2 py-1 rounded text-sm ${
                                                            status === 'InUse'
                                                                ? 'bg-red-500'
                                                                : status === 'Expired'
                                                                ? 'bg-green-500'
                                                                : 'bg-yellow-500'
                                                        }`}
                                                    >
                                                        {status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2 whitespace-nowrap">
                                                    <button
                                                        onClick={() => {
                                                            if (user.userId && user.token) {
                                                                openDeleteModal(user.userId, user.token);
                                                            } else {
                                                                console.error('User ID or Token is missing.');
                                                                showToast('Error: User ID or Token is missing.');
                                                            }
                                                        }}
                                                        className="text-white hover:text-red-700 px-2 py-1 rounded" style={{ color: 'white' }}
                                                    >
                                                        Delete
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            if (user.userId) {
                                                                openRenewModal(user.userId);
                                                            } else {
                                                                console.error('User ID is missing.');
                                                                showToast('Error: User ID is missing.');
                                                            }
                                                        }}
                                                        className="px-2 py-1 rounded ml-2 text-white" style={{ color: 'white' }}
                                                   >
                                                       Renew Token
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={7} className="text-center py-4">
                                            No token user details available.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Renew Token Modal */}
            {isRenewModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                    <div className="p-6 rounded-lg w-96 border border-gray-600" style={{ backgroundColor: '#1a1a1a', borderColor: '#333' }}>
                        <h3 className="text-lg font-bold mb-4" style={{ color: '#FFFFFF' }}>Renew Token</h3>
                        <label className="block mb-4">
                            <span className="text-sm font-semibold">Select Duration:</span>
                            <select
                                value={selectedDuration}
                                onChange={(e) => setSelectedDuration(e.target.value)}
                                className="w-full p-2 rounded mt-1" style={{ backgroundColor: 'rgba(25, 0, 0, 0.7)' }}
                            >
                                <option value="3month">3 Months</option>
                                <option value="6month">6 Months</option>
                                <option value="1year">1 Year</option>
                            </select>
                        </label>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={closeRenewModal}
                                className="px-4 py-2 rounded" style={{ backgroundColor: '#555' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleRenewToken}
                                className="px-4 py-2 rounded text-white" style={{ backgroundColor: '#3b82f6' }}
                            >
                                Renew
                           </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {isDeleteModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                    <div className="p-6 rounded-lg w-96 border border-gray-600" style={{ backgroundColor: '#1a1a1a', borderColor: '#333' }}>
                        <h3 className="text-lg font-bold mb-4" style={{ color: '#FFFFFF' }}>Delete Confirmation</h3>
                        <p className="mb-4">What do you want to delete?</p>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => handleDeleteAction('token')}
                                className="px-4 py-2 rounded text-white" style={{ backgroundColor: '#dc2626' }}
                            >
                                Delete Token
                           </button>
                           <button
                               onClick={() => handleDeleteAction('user')}
                               className="px-4 py-2 rounded text-white" style={{ backgroundColor: '#dc2626' }}
                            >
                                Delete User
                           </button>
                            <button
                                onClick={closeDeleteModal}
                                className="px-4 py-2 rounded" style={{ backgroundColor: '#555' }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}
