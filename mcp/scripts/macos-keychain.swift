import Foundation
import Security

struct KeychainRequest: Decodable {
  let operation: String
  let service: String
  let account: String
  let value: String?
}

struct KeychainResponse: Encodable {
  let found: Bool
  let value: String?
}

func write(_ response: KeychainResponse) {
  guard let data = try? JSONEncoder().encode(response) else { exit(1) }
  FileHandle.standardOutput.write(data)
}

func fail(_ status: OSStatus) -> Never {
  let text = SecCopyErrorMessageString(status, nil) as String? ?? "Keychain error \(status)"
  FileHandle.standardError.write(Data(text.utf8))
  exit(1)
}

let input = FileHandle.standardInput.readDataToEndOfFile()
guard let request = try? JSONDecoder().decode(KeychainRequest.self, from: input),
      !request.service.isEmpty,
      !request.account.isEmpty else {
  FileHandle.standardError.write(Data("Invalid Keychain request".utf8))
  exit(1)
}

func baseQuery() -> [String: Any] {
  [
    kSecClass as String: kSecClassGenericPassword,
    kSecAttrService as String: request.service,
    kSecAttrAccount as String: request.account
  ]
}

switch request.operation {
case "get":
  var query = baseQuery()
  query[kSecReturnData as String] = true
  query[kSecMatchLimit as String] = kSecMatchLimitOne
  var result: CFTypeRef?
  let status = SecItemCopyMatching(query as CFDictionary, &result)
  if status == errSecItemNotFound {
    write(KeychainResponse(found: false, value: nil))
  } else if status == errSecSuccess, let data = result as? Data {
    write(KeychainResponse(found: true, value: String(data: data, encoding: .utf8)))
  } else {
    fail(status)
  }
case "set":
  guard let value = request.value, !value.isEmpty else {
    FileHandle.standardError.write(Data("A Keychain value is required".utf8))
    exit(1)
  }
  let deleteStatus = SecItemDelete(baseQuery() as CFDictionary)
  if deleteStatus != errSecSuccess && deleteStatus != errSecItemNotFound { fail(deleteStatus) }
  var query = baseQuery()
  query[kSecValueData as String] = Data(value.utf8)
  query[kSecAttrLabel as String] = "Wicker Study Canvas token (\(request.account))"
  query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
  let status = SecItemAdd(query as CFDictionary, nil)
  if status == errSecSuccess { write(KeychainResponse(found: true, value: nil)) }
  else { fail(status) }
case "delete":
  let status = SecItemDelete(baseQuery() as CFDictionary)
  if status == errSecSuccess { write(KeychainResponse(found: true, value: nil)) }
  else if status == errSecItemNotFound { write(KeychainResponse(found: false, value: nil)) }
  else { fail(status) }
default:
  FileHandle.standardError.write(Data("Unknown Keychain operation".utf8))
  exit(1)
}
