package com.powerliftingworkoutplanner

import android.util.Base64
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.SocketTimeoutException
import java.security.MessageDigest
import java.security.SecureRandom

/**
 * GH-504 PoC: loopback OAuth callback listener for "Sign in with ChatGPT".
 *
 * OpenAI's open-source plan-usage flow only accepts `http://127.0.0.1:<port>/auth/callback`
 * as redirect URI. On Android the browser and the app share the device loopback interface,
 * so the app can receive the redirect by listening on 127.0.0.1 while the user signs in.
 * Only reachable from the dev-only ChatGPT PoC screen.
 */
class ChatGptLoopbackModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  private val random = SecureRandom()
  @Volatile private var server: ServerSocket? = null

  override fun getName(): String = "ChatGptLoopback"

  private fun base64Url(bytes: ByteArray): String =
      Base64.encodeToString(bytes, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)

  @ReactMethod
  fun randomToken(byteCount: Int, promise: Promise) {
    val bytes = ByteArray(byteCount)
    random.nextBytes(bytes)
    promise.resolve(base64Url(bytes))
  }

  @ReactMethod
  fun randomUuid(promise: Promise) {
    promise.resolve(java.util.UUID.randomUUID().toString())
  }

  /** Returns a PKCE verifier and its S256 challenge. */
  @ReactMethod
  fun createPkce(promise: Promise) {
    val bytes = ByteArray(32)
    random.nextBytes(bytes)
    val verifier = base64Url(bytes)
    val challenge =
        base64Url(MessageDigest.getInstance("SHA-256").digest(verifier.toByteArray(Charsets.US_ASCII)))
    val result = Arguments.createMap()
    result.putString("verifier", verifier)
    result.putString("challenge", challenge)
    promise.resolve(result)
  }

  /** Binds 127.0.0.1:<preferredPort>, falling back to an ephemeral port. Resolves the bound port. */
  @ReactMethod
  fun start(preferredPort: Int, promise: Promise) {
    stopServer()
    try {
      val loopback = InetAddress.getByName("127.0.0.1")
      val socket = ServerSocket()
      socket.reuseAddress = true
      try {
        socket.bind(InetSocketAddress(loopback, preferredPort))
      } catch (e: Exception) {
        socket.bind(InetSocketAddress(loopback, 0))
      }
      server = socket
      promise.resolve(socket.localPort)
    } catch (e: Exception) {
      promise.reject("E_LOOPBACK_START", e.message, e)
    }
  }

  /**
   * Waits for `GET <path>?...` and resolves the request target (path + query).
   * Other requests (e.g. /favicon.ico) get a 404 and are ignored.
   */
  @ReactMethod
  fun awaitCallback(path: String, timeoutMs: Int, promise: Promise) {
    val socket = server
    if (socket == null) {
      promise.reject("E_LOOPBACK_NOT_STARTED", "Loopback listener not started")
      return
    }
    Thread {
      val deadline = System.currentTimeMillis() + timeoutMs
      try {
        while (true) {
          val remaining = deadline - System.currentTimeMillis()
          if (remaining <= 0) throw SocketTimeoutException("Timed out waiting for OAuth callback")
          socket.soTimeout = remaining.toInt()
          socket.accept().use { client ->
            val reader = BufferedReader(InputStreamReader(client.getInputStream(), Charsets.UTF_8))
            val requestLine = reader.readLine() ?: ""
            val target = requestLine.split(" ").getOrNull(1) ?: ""
            val out = client.getOutputStream()
            if (requestLine.startsWith("GET ") && target.substringBefore('?') == path) {
              out.write(httpResponse("200 OK", successPage()).toByteArray(Charsets.UTF_8))
              out.flush()
              promise.resolve(target)
              return@Thread
            }
            out.write(httpResponse("404 Not Found", "Not found").toByteArray(Charsets.UTF_8))
            out.flush()
          }
        }
      } catch (e: SocketTimeoutException) {
        promise.reject("E_LOOPBACK_TIMEOUT", e.message, e)
      } catch (e: Exception) {
        promise.reject("E_LOOPBACK_FAILED", e.message, e)
      } finally {
        stopServer()
      }
    }.start()
  }

  @ReactMethod
  fun stop(promise: Promise) {
    stopServer()
    promise.resolve(null)
  }

  private fun stopServer() {
    try {
      server?.close()
    } catch (_: Exception) {}
    server = null
  }

  private fun httpResponse(status: String, body: String): String {
    val length = body.toByteArray(Charsets.UTF_8).size
    return "HTTP/1.1 $status\r\nContent-Type: text/html; charset=utf-8\r\n" +
        "Content-Length: $length\r\nConnection: close\r\nCache-Control: no-store\r\n\r\n$body"
  }

  private fun successPage(): String {
    val pkg = reactApplicationContext.packageName
    return "<!doctype html><html><head><meta name=\"viewport\" content=\"width=device-width\">" +
        "<title>Gainalytics</title></head><body style=\"font-family:sans-serif;padding:24px\">" +
        "<h2>Sign-in received</h2><p>You can return to Gainalytics now.</p>" +
        "<p><a href=\"intent://#Intent;package=$pkg;action=android.intent.action.MAIN;" +
        "category=android.intent.category.LAUNCHER;end\">Back to Gainalytics</a></p>" +
        "</body></html>"
  }
}
