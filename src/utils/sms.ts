/**
 * Direct Frontend SMSEthiopia Helper
 * Sends SMS notifications directly from the Admin frontend browser.
 */

const DEFAULT_SMS_KEY = 'PEQBNQ8X1P6MBJH76701ZUGIX5DP7UOZ:1098';

export interface SendSmsParams {
    phone?: string;
    text: string;
}

export interface SmsResult {
    success: boolean;
    status_code?: number;
    data?: any;
    error?: string | null;
}

export async function sendSmsEthiopia({ phone = '251993960702', text }: SendSmsParams): Promise<SmsResult> {
    const key = DEFAULT_SMS_KEY;
    const msisdn = '251993960702';

    console.log(`[Frontend SMS-Ethiopia] Dispatching SMS to ${msisdn}...`);

    try {
        const res = await fetch('https://smsethiopia.com/api/sms/send', {
            method: 'POST',
            headers: {
                'KEY': key,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                msisdn,
                text
            })
        });

        const data = await res.json().catch(() => ({}));
        console.log(`[Frontend SMS-Ethiopia] API Response (${res.status}):`, data);

        const isSuccess = res.ok && (
            data.sent === true ||
            data.sent === 'true' ||
            data.sent === 1 ||
            data.status === 'success' ||
            data.status === 'accepted' ||
            data.success === true ||
            (typeof data.description === 'string' && data.description.toLowerCase().includes('accepted'))
        );

        return {
            success: isSuccess,
            status_code: res.status,
            data,
            error: isSuccess ? null : (data.error || data.message || data.description || `HTTP ${res.status}`)
        };
    } catch (err: any) {
        console.error('[Frontend SMS-Ethiopia] Exception:', err.message);
        return { success: false, error: err.message };
    }
}
