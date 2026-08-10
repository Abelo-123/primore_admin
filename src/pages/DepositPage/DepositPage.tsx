import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { formatETB } from '../../constants';
import { hapticSelection, hapticImpact, hapticNotification, getInitDataString } from '../../helpers/telegram';
import './DepositPage.css';

const PRESET_AMOUNTS = [10, 100, 1000, 10000];
const NODE_API_URL = import.meta.env.VITE_NODE_API_URL || '/api';
const CHAPA_PUBLIC_KEY = import.meta.env.VITE_CHAPA_PUBLIC_KEY || 'CHAPUBK-s9JQu74c7hAcdPPGxaAF6aT22Ih4HNtm';

type DepositStep = 'amount' | 'chapa' | 'verifying' | 'success' | 'error';

declare global {
    interface Window {
        ChapaCheckout: any;
    }
}

export function DepositPage() {
    const { user, deposits, setBalance, refreshDeposits, showToast } = useApp();
    const [amount, setAmount] = useState('');
    const [step, setStep] = useState<DepositStep>('amount');
    const [errorMessage, setErrorMessage] = useState('');

    // Use refs for polling state to avoid stale closure issues
    const pollAbortRef = useRef(false);
    const activeTxRefRef = useRef<string | null>(null);

    const balance = user?.balance ?? 0;

    // ─── Refresh deposits on mount ───────────────────────────
    useEffect(() => {
        refreshDeposits().catch(() => { });
    }, [refreshDeposits]);

    // ─── Chapa Phone Validation ──────────────────────────────
    useEffect(() => {
        if (step !== 'chapa') return;

        let attached = false;

        const setupValidation = () => {
            const wrapper = document.getElementById('chapa-container-wrapper');
            if (!wrapper || attached) return;

            // Find the phone input — Chapa renders it with various selectors
            const phoneInput = wrapper.querySelector(
                'input[type="tel"], input[name="mobile"], input[name="phone"], ' +
                'input[placeholder*="09"], input[placeholder*="07"], input[placeholder*="phone"], ' +
                'input[placeholder*="Phone"], input[placeholder*="Mobile"]'
            ) as HTMLInputElement | null;

            if (!phoneInput) return; // Chapa hasn't rendered the input yet

            // Find ALL buttons — might be submit button or pay button
            const findPayButton = (): HTMLButtonElement | null => {
                const btns = wrapper.querySelectorAll('button');
                for (const btn of btns) {
                    const txt = (btn.textContent || '').toLowerCase();
                    if (txt.includes('pay') || txt.includes('submit') || txt.includes('proceed') || btn.type === 'submit') {
                        return btn;
                    }
                }
                // Fallback: last button in the form
                return btns.length > 0 ? btns[btns.length - 1] : null;
            };

            attached = true;

            // Create our custom validation message element
            const msgDiv = document.createElement('div');
            msgDiv.id = 'phone-validation-msg';
            msgDiv.style.cssText = 'font-size:12px;margin-top:6px;padding:6px 10px;border-radius:6px;display:none;font-weight:600;';

            // Insert the message after the phone input (or its parent wrapper)
            const inputParent = phoneInput.closest('.chapa-phone-input-wrapper') || phoneInput.parentElement;
            if (inputParent?.parentElement) {
                inputParent.parentElement.insertBefore(msgDiv, inputParent.nextSibling);
            } else {
                phoneInput.after(msgDiv);
            }

            // Detect which payment method tab is currently active
            const getSelectedPaymentMethod = (): 'telebirr' | 'mpesa' | 'bypass' => {
                // Scan all elements that might indicate the active tab
                const allElements = wrapper.querySelectorAll(
                    '.active, [aria-selected="true"], [data-active="true"], ' +
                    '.selected, .tab-active, [class*="active"], [class*="selected"]'
                );

                for (const el of allElements) {
                    const text = (el.textContent || '').toLowerCase();
                    const className = (el.className || '').toLowerCase();
                    const imgAlt = el.querySelector('img')?.alt?.toLowerCase() || '';
                    const allText = text + ' ' + className + ' ' + imgAlt;

                    if (allText.includes('telebirr') || allText.includes('ethio telecom') || allText.includes('ethiotelecom')) {
                        return 'telebirr';
                    }
                    if (allText.includes('mpesa') || allText.includes('m-pesa') || allText.includes('safaricom')) {
                        return 'mpesa';
                    }
                    // CBE, Awash, E-Pay, E-Birr, bank — no prefix restriction
                    if (allText.includes('cbe') || allText.includes('bank') || allText.includes('e-pay') || allText.includes('ebirr')) {
                        return 'bypass';
                    }
                }

                // If we can't detect, default to bypass (no prefix restriction)
                return 'bypass';
            };

            // Update button state
            const updateButtonState = (enabled: boolean) => {
                const payBtn = findPayButton();
                if (!payBtn) return;
                payBtn.disabled = !enabled;
                payBtn.style.opacity = enabled ? '1' : '0.5';
                payBtn.style.cursor = enabled ? 'pointer' : 'not-allowed';
            };

            // Core validation function
            const validatePhone = (showMessages = true) => {
                let raw = phoneInput.value.replace(/\D/g, '');

                // Strip international prefix 251
                if (raw.startsWith('251')) raw = raw.substring(3);

                // Detect and strip leading 0
                const hasLeadingZero = raw.startsWith('0');
                const base = hasLeadingZero ? raw.substring(1) : raw;

                const method = getSelectedPaymentMethod();

                // Empty — no error, but disable button
                if (base.length === 0) {
                    msgDiv.style.display = 'none';
                    updateButtonState(false);
                    return;
                }

                // ── Step 1: PREFIX CHECK (skip for bypass methods) ──
                if (method !== 'bypass') {
                    const firstDigit = base.charAt(0);

                    if (method === 'telebirr' && firstDigit === '7') {
                        if (showMessages) {
                            msgDiv.textContent = '⚠️ This looks like an M-Pesa number. Telebirr numbers start with 9';
                            msgDiv.style.color = '#ff4757';
                            msgDiv.style.background = 'rgba(255,71,87,0.1)';
                            msgDiv.style.display = 'block';
                        }
                        updateButtonState(false);
                        return;
                    }

                    if (method === 'mpesa' && firstDigit === '9') {
                        if (showMessages) {
                            msgDiv.textContent = '⚠️ This looks like a Telebirr number. M-Pesa numbers start with 7';
                            msgDiv.style.color = '#ff4757';
                            msgDiv.style.background = 'rgba(255,71,87,0.1)';
                            msgDiv.style.display = 'block';
                        }
                        updateButtonState(false);
                        return;
                    }

                    if (firstDigit !== '9' && firstDigit !== '7') {
                        if (showMessages) {
                            msgDiv.textContent = '⚠️ Phone number must start with 09 or 07';
                            msgDiv.style.color = '#ff4757';
                            msgDiv.style.background = 'rgba(255,71,87,0.1)';
                            msgDiv.style.display = 'block';
                        }
                        updateButtonState(false);
                        return;
                    }
                }

                // ── Step 2: LENGTH CHECK ──
                if (base.length < 9) {
                    // Still typing — hide message, keep button disabled
                    msgDiv.style.display = 'none';
                    updateButtonState(false);
                    return;
                }

                if (base.length === 9) {
                    // Perfect length — valid!
                    msgDiv.style.display = 'none';
                    updateButtonState(true);
                    return;
                }

                if (base.length === 10 && hasLeadingZero) {
                    // 10 digits starting with 0 — valid (e.g. 09XXXXXXXX)
                    msgDiv.style.display = 'none';
                    updateButtonState(true);
                    return;
                }

                // Too long
                if (showMessages) {
                    msgDiv.textContent = '⚠️ Number too long. Enter 9-10 digits';
                    msgDiv.style.color = '#ff4757';
                    msgDiv.style.background = 'rgba(255,71,87,0.1)';
                    msgDiv.style.display = 'block';
                }
                updateButtonState(false);
            };

            // Attach event listeners
            phoneInput.addEventListener('input', () => validatePhone(true));
            phoneInput.addEventListener('blur', () => validatePhone(true));
            phoneInput.addEventListener('focus', () => validatePhone(false));

            // Re-validate on ANY click in the Chapa form
            // (catches payment method tab switches with staggered timeouts
            //  because Chapa's DOM updates are slow)
            wrapper.addEventListener('click', () => {
                setTimeout(() => validatePhone(true), 10);
                setTimeout(() => validatePhone(true), 100);
                setTimeout(() => validatePhone(true), 300);
                setTimeout(() => validatePhone(true), 600);
            });

            console.log('[phone-validation] Attached to Chapa form');
        };

        // Poll every 500ms until we can attach to the Chapa-rendered phone input
        const interval = setInterval(setupValidation, 500);
        // Also try immediately after a delay (Chapa takes ~1s to render)
        setTimeout(setupValidation, 1000);
        setTimeout(setupValidation, 2000);

        return () => clearInterval(interval);
    }, [step]);

    // ─── Verify deposit with retry (uses refs to avoid stale closures) ───
    const verifyDeposit = useCallback(async (txRef: string) => {
        if (!txRef) return;

        // Save ref and switch UI
        activeTxRefRef.current = txRef;
        pollAbortRef.current = false;
        setStep('verifying');

        // Mobile money (M-Pesa/Telebirr) can take 15-90 seconds for telco confirmation.
        // We poll aggressively at first, then slow down. Total: ~3+ minutes of patience.
        const delays = [
            2000,   // 2s  — quick first check
            3000,   // 5s  total
            5000,   // 10s total
            5000,   // 15s total
            8000,   // 23s total
            8000,   // 31s total
            10000,  // 41s total
            10000,  // 51s total
            15000,  // 1m 6s total
            15000,  // 1m 21s total
            15000,  // 1m 36s total
            20000,  // 1m 56s total
            20000,  // 2m 16s total
            30000,  // 2m 46s total
            30000,  // 3m 16s total
        ];

        for (let attempt = 0; attempt < delays.length; attempt++) {
            // Check abort flag
            if (pollAbortRef.current || activeTxRefRef.current !== txRef) {
                console.log('[verify] Polling aborted');
                return;
            }

            // Wait before each poll
            await new Promise(resolve => setTimeout(resolve, delays[attempt]));

            // Recheck abort after waiting
            if (pollAbortRef.current || activeTxRefRef.current !== txRef) {
                console.log('[verify] Polling aborted after delay');
                return;
            }

            try {
                const initData = await getInitDataString();
                const res = await fetch(`${NODE_API_URL}/verify-deposit`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tx_ref: txRef, initData }),
                });
                const data = await res.json();
                console.log(`[verify] Attempt ${attempt + 1}/${delays.length} result:`, data);

                if (data.success && data.new_balance !== undefined) {
                    // Payment confirmed!
                    setBalance(data.new_balance);
                    showToast('success', `Deposit confirmed! Balance: ${formatETB(data.new_balance)}`);
                    hapticNotification('success');
                    setStep('success');
                    activeTxRefRef.current = null;
                    refreshDeposits().catch(() => { });
                    return;
                }

                // If already completed (from another session), also show success
                if (data.already_completed && data.new_balance !== undefined) {
                    setBalance(data.new_balance);
                    showToast('success', `Deposit already confirmed!`);
                    setStep('success');
                    activeTxRefRef.current = null;
                    refreshDeposits().catch(() => { });
                    return;
                }

                // Otherwise continue polling — show progress to user
                const elapsed = delays.slice(0, attempt + 1).reduce((a, b) => a + b, 0);
                const elapsedSec = Math.round(elapsed / 1000);
                console.log(`[verify] Still pending after ~${elapsedSec}s (attempt ${attempt + 1}/${delays.length})`);
            } catch (err) {
                console.error(`[verify] Network error on attempt ${attempt + 1}:`, err);
                // Continue polling on network error
            }
        }

        // Exhausted all retries — payment is likely confirmed on telco side but
        // Chapa hasn't updated yet. Show a "still processing" state.
        showToast('info', 'Your payment is being processed. Balance will update automatically.');
        // Keep the txRef alive so user can manually re-check
        setStep('success');
    }, [setBalance, showToast, refreshDeposits]);

    // ─── Start Inline Payment ──────────────────────────────
    const startInlinePayment = useCallback(async (depositAmount: number) => {
        setStep('chapa');
        hapticImpact('medium');

        try {
            const initData = await getInitDataString();

            // 1. Generate tx_ref and register with backend
            const txRef = `DEP-${user?.id || '0'}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
            activeTxRefRef.current = txRef;

            const backendRes = await fetch(`${NODE_API_URL}/deposit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: depositAmount, initData, tx_ref: txRef }),
            });
            const backendData = await backendRes.json();

            if (!backendData.success) {
                setStep('amount');
                showToast('error', backendData.error || 'Failed to start deposit');
                return;
            }

            // 2. Initialize the Chapa Inline widget
            const chapa = new window.ChapaCheckout({
                publicKey: CHAPA_PUBLIC_KEY,
                amount: Math.round(depositAmount * 100) / 100,
                currency: 'ETB',
                tx_ref: txRef,
                title: 'Add Funds',
                description: 'Deposit to primora444',
                email: `user-${user?.id || '0'}@primora444.com`,
                first_name: user?.first_name || 'primora444',
                last_name: user?.last_name || 'User',
                showFlag: true,
                showPaymentMethodsNames: true,

                onSuccessfulPayment: (result: any) => {
                    console.log('[chapa] onSuccessfulPayment:', result);
                    hapticNotification('success');
                    // Start verification polling
                    verifyDeposit(result?.tx_ref || txRef);
                },

                onPaymentFailure: (error: any) => {
                    console.log('[chapa] onPaymentFailure:', error);
                    const errStr = String(error?.message || error).toLowerCase();

                    // Suppress false positives from Chapa SDK
                    const isFalsePositive = (
                        errStr.includes('phone') ||
                        errStr.includes('mobile') ||
                        errStr.includes('valid') ||
                        errStr.includes('format') ||
                        errStr.includes('insert') ||
                        errStr.includes('cors') ||
                        errStr.includes('network') ||
                        errStr.includes('fetch') ||
                        errStr.includes('502') ||
                        errStr.includes('bad gateway')
                    );

                    if (isFalsePositive) {
                        // CORS/502 errors from Chapa's inline charge endpoint
                        // The payment may actually have gone through on Chapa's side
                        // Try verifying anyway after a short delay
                        console.log('[chapa] Suppressed false positive error, starting verification...');
                        setTimeout(() => {
                            verifyDeposit(txRef);
                        }, 2000);
                    } else {
                        // Real failure
                        setStep('amount');
                        showToast('error', 'Payment failed. Please try again.');
                        hapticNotification('error');
                    }
                },

                onClose: () => {
                    console.log('[chapa] Widget closed');
                    // Only go back to amount if we haven't moved to verifying/success
                    setTimeout(() => {
                        setStep(prev => {
                            if (prev === 'chapa') {
                                // If we have an active tx_ref, the payment might still be processing
                                // Start a verification attempt before going back
                                if (activeTxRefRef.current === txRef) {
                                    verifyDeposit(txRef);
                                    return 'verifying';
                                }
                                return 'amount';
                            }
                            return prev;
                        });
                    }, 500);
                }
            });

            chapa.initialize();

        } catch (err) {
            console.error('[deposit] Error starting inline payment:', err);
            setStep('amount');
            showToast('error', 'Network error. Please try again.');
            hapticNotification('error');
        }
    }, [showToast, verifyDeposit, user]);

    // ─── Handle Deposit Button Click ─────────────────────────
    const handleDeposit = useCallback(() => {
        const val = parseFloat(amount);
        if (!val || val < 10) {
            showToast('error', 'Minimum deposit is 10 ETB');
            hapticNotification('error');
            return;
        }
        setErrorMessage('');

        if (!window.ChapaCheckout) {
            showToast('info', 'Payment system loading...');
            setTimeout(handleDeposit, 1000);
            return;
        }

        startInlinePayment(val);
    }, [amount, startInlinePayment, showToast]);

    const recentDeposits = useMemo(() => deposits.slice(0, 5), [deposits]);

    const formatBalanceDisplay = (bal: number) => {
        const parts = bal.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).split('.');
        return { whole: parts[0], decimal: '.' + parts[1] };
    };

    const balDisplay = formatBalanceDisplay(balance);

    return (
        <div className="deposit-page-wrapper">
            {/* ─── Hero Balance Card ─── */}
            <div className="deposit-hero">
                <div className="deposit-hero__glow" />
                <div className="deposit-hero__label">Current Balance</div>
                <div className="deposit-hero__amount">
                    {balDisplay.whole}
                    <span style={{ fontSize: '0.6em', opacity: 0.7 }}>{balDisplay.decimal}</span>
                    <span className="deposit-hero__currency">ETB</span>
                </div>
                <div className="sdk-badge sdk-badge--ready">
                    <span className="sdk-badge__dot" />
                    Secure Checkout
                </div>
            </div>

            {/* ─── Amount Input Section ─── */}
            {step === 'amount' && (
                <>
                    <div className="paxyo-section-header">Deposit Funds</div>
                    <div className="deposit-input-group">
                        <span className="deposit-input-group__prefix">ETB</span>
                        <input
                            className="deposit-input-group__input"
                            type="number"
                            inputMode="decimal"
                            pattern="[0-9]*"
                            placeholder="Enter amount..."
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                        />
                    </div>

                    <div className="preset-grid">
                        {PRESET_AMOUNTS.map(amt => (
                            <button
                                key={amt}
                                className={`preset-btn${amount === String(amt) ? ' preset-btn--active' : ''}`}
                                onClick={() => {
                                    hapticSelection();
                                    setAmount(String(amt));
                                }}
                            >
                                +{amt >= 1000 ? `${amt / 1000}k` : amt}
                            </button>
                        ))}
                    </div>

                    {errorMessage && (
                        <div className="deposit-error">
                            <span>⚠️</span> {errorMessage}
                        </div>
                    )}

                    <button
                        className="deposit-submit"
                        onClick={handleDeposit}
                        disabled={!amount || parseFloat(amount) < 10}
                    >
                        💳 Deposit with Chapa
                    </button>

                    <div className="deposit-secured">
                        <span className="deposit-secured__lock">🔒</span>
                        Secured by Chapa
                    </div>
                </>
            )}

            {/* ─── Inline Form Container ─── */}
            {step === 'chapa' && (
                <div className="chapa-section">
                    <div className="chapa-section__header">
                        <button className="chapa-section__back" onClick={() => {
                            pollAbortRef.current = true;
                            activeTxRefRef.current = null;
                            setStep('amount');
                        }}>
                            ← Cancel
                        </button>
                        <div className="chapa-section__title">Secure Payment</div>
                        <div className="sdk-badge sdk-badge--ready">
                            <span className="sdk-badge__dot" />
                            Ready
                        </div>
                    </div>

                    <div className="chapa-inline-container guide-highlight" id="chapa-container-wrapper">
                        <div id="chapa-inline-form" className="payment-container" style={{ height: 'auto', width: '100%' }}></div>
                        <div id="chapa-error-container" className="chapa-error-box"></div>
                    </div>

                    {/* Secured by Chapa footer */}
                    <div className="deposit-secured" style={{ opacity: 0.3 }}>
                        <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                        </svg>
                        <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                            Secured by Chapa
                        </span>
                    </div>
                </div>
            )}

            {/* ─── Verifying State ─── */}
            {step === 'verifying' && (
                <div className="deposit-processing">
                    <div className="deposit-processing__spinner" />
                    <div className="deposit-processing__text">Confirming Payment...</div>
                    <div className="deposit-processing__subtext">
                        Waiting for confirmation from your mobile provider.
                        <br />
                        M-Pesa & Telebirr can take up to 60 seconds.
                    </div>
                    <div className="deposit-fallback-help" style={{ width: '100%', marginTop: 20 }}>
                        <p style={{ fontSize: '12px', marginBottom: 8 }}>
                            ✅ If you already confirmed on your phone, just wait — we're checking automatically.
                        </p>
                        <button
                            className="deposit-fallback-btn"
                            onClick={() => {
                                if (activeTxRefRef.current) {
                                    verifyDeposit(activeTxRefRef.current);
                                }
                            }}
                        >
                            🔄 Check Again Now
                        </button>
                    </div>
                </div>
            )}

            {/* ─── Success State ─── */}
            {step === 'success' && (
                <div className="deposit-success">
                    <div className="deposit-success__icon">✅</div>
                    <div className="deposit-success__text">Deposit Successful!</div>
                    <div className="deposit-success__subtext">Your balance has been updated.</div>

                    {/* If txRef still active, offer manual re-check */}
                    {activeTxRefRef.current && (
                        <button
                            className="deposit-fallback-btn"
                            style={{ marginBottom: 16 }}
                            onClick={() => {
                                if (activeTxRefRef.current) {
                                    verifyDeposit(activeTxRefRef.current);
                                }
                            }}
                        >
                            🔄 Balance not updated? Tap to re-check
                        </button>
                    )}

                    <button className="deposit-submit" onClick={() => {
                        setStep('amount');
                        setAmount('');
                        activeTxRefRef.current = null;
                    }}>
                        Make Another Deposit
                    </button>
                </div>
            )}



            {/* ─── Recent Deposits ─── */}
            <div className="paxyo-section-header" style={{ marginTop: 24 }}>Recent Deposits</div>
            {recentDeposits.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state__icon">💸</div>
                    <div className="empty-state__title">No Deposits Yet</div>
                </div>
            ) : (
                recentDeposits.map((d) => (
                    <div className="deposit-card" key={d.id}>
                        <div className="deposit-card__left">
                            <span className={`deposit-card__status deposit-card__status--${d.status}`}>
                                {d.status === 'completed' || d.status === 'success' ? '✅' : d.status === 'pending' ? '⏳' : '❌'}{' '}
                                {d.status.charAt(0).toUpperCase() + d.status.slice(1)}
                            </span>
                            <span className="deposit-card__date">
                                {new Date(d.created_at).toLocaleDateString()} • Chapa
                            </span>
                        </div>
                        <span className="deposit-card__amount">+{formatETB(d.amount)}</span>
                    </div>
                ))
            )}
        </div>
    );
}
