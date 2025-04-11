type SanitizedResponse = {
    success: boolean;
    deployed?: boolean;
    expired?: boolean;
};

export const sanitizeResponse = (response: any): SanitizedResponse => {
    const sanitized: SanitizedResponse = {
        success: false
    };

    if (!response) return sanitized;

    // Convert to success/failure only
    sanitized.success = response.status === 200 || 
                       response.status === 201 || 
                       response.ok === true;

    // Only pass through specific allowed flags
    if (typeof response.deployed === 'boolean') {
        sanitized.deployed = response.deployed;
    }

    if (typeof response.expired === 'boolean') {
        sanitized.expired = response.expired;
    }

    return sanitized;
};