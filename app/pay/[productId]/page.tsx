'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Product } from '@/lib/types'
import { getCryptoPrice, calculateCryptoAmount } from '@/lib/blockchain'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Coins, Copy, Check, Clock, ExternalLink } from 'lucide-react'
import QRCode from 'qrcode'
import Image from 'next/image'

export default function PaymentPage() {
  const params = useParams()
  const productId = params.productId as string

  const [product, setProduct] = useState<Product | null>(null)
  const [cryptoPrice, setCryptoPrice] = useState(0)
  const [cryptoAmount, setCryptoAmount] = useState(0)
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [buyerEmail, setBuyerEmail] = useState('')
  const [buyerWallet, setBuyerWallet] = useState('')
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'pending' | 'confirmed' | 'failed'>('idle')
  const [paymentId, setPaymentId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [verificationInterval, setVerificationInterval] = useState<NodeJS.Timeout | null>(null)

  useEffect(() => {
    fetchProduct()
    return () => {
      if (verificationInterval) {
        clearInterval(verificationInterval)
      }
    }
  }, [productId])

  const fetchProduct = async () => {
    try {
      const response = await fetch(`/api/products/${productId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Product not found')
      }

      if (!data.is_active) {
        throw new Error('This product is no longer available')
      }

      setProduct(data)
      await fetchCryptoPrice(data)
      await generateQRCode(data)
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchCryptoPrice = async (product: Product) => {
    try {
      const priceMap: { [key: string]: string } = {
        SOL: 'solana',
        ETH: 'ethereum',
        USDT: 'tether',
        USDC: 'usd-coin'
      }

      const coinId = priceMap[product.currency]
      const price = await getCryptoPrice(coinId)
      setCryptoPrice(price)
      
      const amount = calculateCryptoAmount(product.price_usd, price)
      setCryptoAmount(amount)
    } catch (error) {
      console.error('Failed to fetch crypto price:', error)
    }
  }

  const generateQRCode = async (product: Product) => {
    try {
      const qrString = product.recipient_wallet
      const qrCodeDataUrl = await QRCode.toDataURL(qrString, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      })
      setQrCodeUrl(qrCodeDataUrl)
    } catch (error) {
      console.error('Failed to generate QR code:', error)
    }
  }

  const copyWalletAddress = () => {
    if (product) {
      navigator.clipboard.writeText(product.recipient_wallet)
    }
  }

  const handlePaymentSubmission = async () => {
    if (!product || !buyerEmail || !buyerWallet) {
      setError('Please provide your email address and wallet address')
      return
    }

    // Validate wallet address format
    if (!isValidWalletAddress(buyerWallet, product.chain)) {
      setError('Please enter a valid wallet address for the selected blockchain')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Create payment record via API
      const response = await fetch('/api/payments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          buyerEmail,
          buyerWallet
        })
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create payment')
      }
      
      setPaymentId(data.paymentId)
      setPaymentStatus('pending')

      // Start verification process
      startPaymentVerification(data.paymentId)
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const startPaymentVerification = (paymentId: string) => {
    }, 10000) // Check every 10 seconds
    const response = await fetch('/api/verify-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentId })
    })

    const data = await response.json()

    if (data.success) {
      setPaymentStatus('confirmed')
      if (verificationInterval) {
        clearInterval(verificationInterval)
      }
    } else if (data.error) {
      setError(data.error)
      setPaymentStatus('failed')
      if (verificationInterval) {
        clearInterval(verificationInterval)
      }
        if (error) throw error

        setPaymentStatus('confirmed')
        
        if (verificationInterval) {
          clearInterval(verificationInterval)
        }

        // Trigger invoice generation and email
        await fetch('/api/send-confirmation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentId })
        })
      }
    } catch (error) {
      console.error('Payment verification error:', error)
    }
  }

  const isValidWalletAddress = (address: string, chain: string): boolean => {
    if (chain === 'solana') {
      // Solana addresses are base58 encoded and typically 32-44 characters
      return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)
    } else if (chain === 'ethereum') {
      // Ethereum addresses are 42 characters starting with 0x
      return /^0x[a-fA-F0-9]{40}$/.test(address)
    }
    return false
  }

  const getBlockExplorerUrl = (hash: string) => {
    if (product?.chain === 'solana') {
      return `https://solscan.io/tx/${hash}?cluster=devnet`
    } else {
      return `https://etherscan.io/tx/${hash}`
    }
  }

  if (loading && !product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Coins className="h-12 w-12 text-green-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading payment page...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="text-center py-12">
            <div className="text-red-500 mb-4">
              <svg className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Error</h3>
            <p className="text-gray-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="text-center py-12">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Product Not Found</h3>
            <p className="text-gray-600">This payment link is no longer valid.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Coins className="h-8 w-8 text-green-600 mr-2" />
            <h1 className="text-2xl font-bold text-gray-900">CryptoPayLink</h1>
          </div>
          <p className="text-gray-600">Secure cryptocurrency payment</p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-xl">{product.name}</CardTitle>
            {product.description && (
              <p className="text-gray-600">{product.description}</p>
            )}
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Payment Details */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Amount to Pay</Label>
                  <div className="text-2xl font-bold text-green-600">
                    ${product.price_usd}
                  </div>
                  <div className="text-lg text-gray-600">
                    ≈ {cryptoAmount.toFixed(6)} {product.currency}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="capitalize">
                      {product.chain}
                    </Badge>
                    <Badge variant="outline">
                      {product.currency}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Send to Wallet Address</Label>
                  <div className="flex items-center space-x-2">
                    <code className="flex-1 p-2 bg-gray-100 rounded text-sm break-all">
                      {product.recipient_wallet}
                    </code>
                    <Button variant="outline" size="sm" onClick={copyWalletAddress}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {paymentStatus === 'idle' && (
                  <div className="space-y-2">
                    <Label htmlFor="email">Your Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your email for receipt"
                      value={buyerEmail}
                      onChange={(e) => setBuyerEmail(e.target.value)}
                      required
                    />
                  </div>
                )}

                {paymentStatus === 'idle' && (
                  <div className="space-y-2">
                    <Label htmlFor="wallet">Your Wallet Address *</Label>
                    <Input
                      id="wallet"
                      type="text"
                      placeholder={
                        product.chain === 'solana' 
                          ? 'Enter your Solana wallet address'
                          : 'Enter your Ethereum wallet address (0x...)'
                      }
                      value={buyerWallet}
                      onChange={(e) => setBuyerWallet(e.target.value)}
                      required
                    />
                    <p className="text-xs text-gray-500">
                      This must be the wallet address you're sending the payment from
                    </p>
                  </div>
                )}
              </div>

              {/* QR Code */}
              <div className="flex flex-col items-center space-y-4">
                <div className="text-center">
                  <Label className="block mb-2">Scan QR Code</Label>
                  {qrCodeUrl && (
                    <div className="inline-block p-4 bg-white rounded-lg shadow">
                      <Image
                        src={qrCodeUrl}
                        alt="Payment QR Code"
                        width={200}
                        height={200}
                        className="rounded"
                      />
                    </div>
                  )}
                </div>
                <p className="text-sm text-gray-600 text-center">
                  Scan with your crypto wallet to send payment
                </p>
              </div>
            </div>

            {/* Payment Status */}
            {paymentStatus !== 'idle' && (
              <div className="mt-6 p-4 rounded-lg border">
                {paymentStatus === 'pending' && (
                  <div className="flex items-center space-x-3">
                    <Clock className="h-5 w-5 text-yellow-500 animate-pulse" />
                    <div>
                      <p className="font-medium text-yellow-700">Payment Pending</p>
                      <p className="text-sm text-gray-600">
                        Waiting for transaction confirmation. This may take a few minutes.
                      </p>
                    </div>
                  </div>
                )}
                
                {paymentStatus === 'confirmed' && (
                  <div className="flex items-center space-x-3">
                    <Check className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="font-medium text-green-700">Payment Confirmed!</p>
                      <p className="text-sm text-gray-600">
                        Your payment has been verified. Check your email for the receipt.
                      </p>
                    </div>
                  </div>
                )}
                
                {paymentStatus === 'failed' && (
                  <div className="flex items-center space-x-3">
                    <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <div>
                      <p className="font-medium text-red-700">Payment Verification Failed</p>
                      <p className="text-sm text-gray-600">
                        We could not verify your payment. Please try again or contact support.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Action Button */}
            {paymentStatus === 'idle' && (
              <div className="mt-6">
                <Button 
                  className="w-full bg-green-600 hover:bg-green-700"
                  onClick={handlePaymentSubmission}
                  disabled={loading || !buyerEmail || !buyerWallet}
                >
                  {loading ? 'Processing...' : "I've Sent the Payment"}
                </Button>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Click only after sending the exact amount from your specified wallet address
                </p>
              </div>
            )}

            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md">
                {error}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Payment Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex items-start space-x-2">
                <span className="font-medium text-green-600">1.</span>
                <p>Copy the recipient wallet address or scan the QR code with your crypto wallet</p>
              </div>
              <div className="flex items-start space-x-2">
                <span className="font-medium text-green-600">2.</span>
                <p>Send exactly <strong>{cryptoAmount.toFixed(6)} {product.currency}</strong> to the address</p>
              </div>
              <div className="flex items-start space-x-2">
                <span className="font-medium text-green-600">3.</span>
                <p>Enter your email and the wallet address you're sending from, then click "I've Sent the Payment"</p>
              </div>
              <div className="flex items-start space-x-2">
                <span className="font-medium text-green-600">4.</span>
                <p>Wait for automatic verification (usually takes 1-5 minutes)</p>
              </div>
              <div className="flex items-start space-x-2">
                <span className="font-medium text-green-600">5.</span>
                <p>You will receive an email confirmation with your receipt</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-sm text-gray-500">
            Powered by <span className="font-medium text-green-600">CryptoPayLink</span>
          </p>
        </div>
      </div>
    </div>
  )
}