import Contacts
import Foundation

enum ContactsDuplicatesError: Error {
  case contactNotFound
}

/**
 * Finds contacts that look like duplicates and (separately) applies the
 * user's chosen fix. Detection is read-only; nothing here ever touches a
 * contact except `mergeContacts`/`deleteContacts`, both called only after the
 * user has confirmed an action for a specific group.
 */
final class ContactsDuplicatesProvider: NSObject {

  private let store = CNContactStore()
  private static let keysToFetch: [CNKeyDescriptor] = [
    CNContactGivenNameKey as CNKeyDescriptor,
    CNContactMiddleNameKey as CNKeyDescriptor,
    CNContactFamilyNameKey as CNKeyDescriptor,
    CNContactPhoneNumbersKey as CNKeyDescriptor,
    CNContactEmailAddressesKey as CNKeyDescriptor,
  ]

  // MARK: Scan

  @objc func scanDuplicates() -> [[String: Any]] {
    let contacts = fetchAllContacts()
    guard contacts.count >= 2 else { return [] }

    var unionFind = UnionFind(count: contacts.count)
    // index -> set of reasons ("phone" / "email" / "name") that fired for
    // *some* pair touching this contact; used below to explain each final
    // group without re-deriving it per contact.
    var reasonsByIndex: [Int: Set<String>] = [:]

    func union(_ i: Int, _ j: Int, reason: String) {
      unionFind.union(i, j)
      reasonsByIndex[i, default: []].insert(reason)
      reasonsByIndex[j, default: []].insert(reason)
    }

    // Pass 1: exact match on normalized phone / email — cheap, unambiguous,
    // and the strongest possible signal short of a full-contact diff.
    groupIndices(contacts, by: { $0.normalizedPhones }).forEach { indices in
      for i in 1..<indices.count { union(indices[0], indices[i], reason: "phone") }
    }
    groupIndices(contacts, by: { $0.normalizedEmails }).forEach { indices in
      for i in 1..<indices.count { union(indices[0], indices[i], reason: "email") }
    }

    // Pass 2: fuzzy name match. Weak on its own (people share names), so it
    // never upgrades a group's confidence past 'low' by itself — see
    // `describeGroup` below.
    for i in 0..<contacts.count {
      for j in (i + 1)..<contacts.count {
        if Self.namesMatch(contacts[i].normalizedName, contacts[j].normalizedName) {
          union(i, j, reason: "name")
        }
      }
    }

    var membersByRoot: [Int: [Int]] = [:]
    for i in 0..<contacts.count {
      membersByRoot[unionFind.find(i), default: []].append(i)
    }

    return membersByRoot.values
      .filter { $0.count >= 2 }
      .map { indices in describeGroup(indices.map { contacts[$0] }, reasons: reasonsForGroup(indices, reasonsByIndex)) }
  }

  private func reasonsForGroup(_ indices: [Int], _ reasonsByIndex: [Int: Set<String>]) -> Set<String> {
    indices.reduce(into: Set<String>()) { acc, i in acc.formUnion(reasonsByIndex[i] ?? []) }
  }

  private func describeGroup(_ members: [ContactRecord], reasons: Set<String>) -> [String: Any] {
    // 'high' whenever a hard identity signal (phone or email) fired anywhere
    // in the group — even if that pair also happened to match by name.
    let confidence = (reasons.contains("phone") || reasons.contains("email")) ? "high" : "low"
    return [
      "id": UUID().uuidString,
      "confidence": confidence,
      "matchedOn": Array(reasons).sorted(),
      "contacts": members.map { $0.summary },
    ]
  }

  // MARK: Merge

  @objc(mergeContactsWithPrimaryId:duplicateIds:completion:)
  func mergeContacts(primaryId: String, duplicateIds: [String], completion: @escaping (Error?) -> Void) {
    do {
      guard let primary = try fetchMutable(primaryId) else {
        completion(ContactsDuplicatesError.contactNotFound)
        return
      }

      var existingPhones = Set(primary.phoneNumbers.map { Self.normalizePhone($0.value.stringValue) })
      var existingEmails = Set(primary.emailAddresses.map { Self.normalizeEmail($0.value as String) })

      let duplicates = try duplicateIds.compactMap { try fetchMutable($0) }
      for duplicate in duplicates {
        for phone in duplicate.phoneNumbers {
          let normalized = Self.normalizePhone(phone.value.stringValue)
          guard !existingPhones.contains(normalized) else { continue }
          existingPhones.insert(normalized)
          primary.phoneNumbers.append(phone)
        }
        for email in duplicate.emailAddresses {
          let normalized = Self.normalizeEmail(email.value as String)
          guard !existingEmails.contains(normalized) else { continue }
          existingEmails.insert(normalized)
          primary.emailAddresses.append(email)
        }
        // Fill in a name part only if the primary is missing it — the
        // primary's own name is never overwritten, only completed.
        if primary.givenName.isEmpty { primary.givenName = duplicate.givenName }
        if primary.middleName.isEmpty { primary.middleName = duplicate.middleName }
        if primary.familyName.isEmpty { primary.familyName = duplicate.familyName }
      }

      let request = CNSaveRequest()
      request.update(primary)
      for duplicate in duplicates {
        request.delete(duplicate)
      }
      try store.execute(request)
      completion(nil)
    } catch {
      completion(error)
    }
  }

  // MARK: Delete

  @objc(deleteContactsWithIds:completion:)
  func deleteContacts(ids: [String], completion: @escaping (Error?) -> Void) {
    do {
      let request = CNSaveRequest()
      for id in ids {
        guard let mutable = try fetchMutable(id) else { continue }
        request.delete(mutable)
      }
      try store.execute(request)
      completion(nil)
    } catch {
      completion(error)
    }
  }

  private func fetchMutable(_ id: String) throws -> CNMutableContact? {
    let contact = try store.unifiedContact(withIdentifier: id, keysToFetch: Self.keysToFetch)
    return contact.mutableCopy() as? CNMutableContact
  }

  // MARK: Fetch + grouping helpers

  private func fetchAllContacts() -> [ContactRecord] {
    let request = CNContactFetchRequest(keysToFetch: Self.keysToFetch)
    var records: [ContactRecord] = []
    try? store.enumerateContacts(with: request) { contact, _ in
      records.append(ContactRecord(contact))
    }
    return records
  }

  /// Buckets contact indices by each of their normalized values for `key`
  /// (a contact with two phones lands in two buckets), then returns only the
  /// buckets that actually collide across more than one contact.
  private func groupIndices(_ contacts: [ContactRecord], by key: (ContactRecord) -> [String]) -> [[Int]] {
    var buckets: [String: [Int]] = [:]
    for (index, contact) in contacts.enumerated() {
      for value in key(contact) where !value.isEmpty {
        buckets[value, default: []].append(index)
      }
    }
    return buckets.values.filter { Set($0).count >= 2 }.map { Array(Set($0)) }
  }

  // MARK: Normalization

  /// Strips everything but digits, then keeps the last 10 — the shortest
  /// national-significant-number length common to the phone formats this app
  /// is likely to see, so "+91 98765 43210", "098765 43210" and
  /// "9876543210" all normalize the same way regardless of country-code or
  /// leading-zero conventions.
  static func normalizePhone(_ raw: String) -> String {
    let digits = raw.filter(\.isNumber)
    return digits.count > 10 ? String(digits.suffix(10)) : digits
  }

  static func normalizeEmail(_ raw: String) -> String {
    raw.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
  }

  /// Lowercased, accent-folded, punctuation/title-stripped token set — so
  /// "Dr. Ankit Sharma" and "ankit sharma" compare equal regardless of case,
  /// accents, or a title prefix.
  private static let titlePrefixes: Set<String> = ["mr", "mrs", "ms", "miss", "dr", "prof"]

  static func normalizeNameTokens(_ raw: String) -> [String] {
    let folded = raw.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: nil)
    let cleaned = folded.unicodeScalars.map { CharacterSet.alphanumerics.contains($0) ? Character($0) : " " }
    return String(cleaned)
      .split(separator: " ")
      .map(String.init)
      .filter { !$0.isEmpty && !titlePrefixes.contains($0) }
  }

  /// Order-independent token match (handles "Sharma Ankit" vs "Ankit
  /// Sharma"), or a small edit distance on the full joined name (handles a
  /// typo like "Jon Smith" vs "John Smith"). Either signal alone is enough —
  /// confidence for a name-only match still caps at 'low' regardless.
  private static func namesMatch(_ a: [String], _ b: [String]) -> Bool {
    guard !a.isEmpty, !b.isEmpty else { return false }
    if Set(a) == Set(b) { return true }
    let joinedA = a.joined()
    let joinedB = b.joined()
    guard !joinedA.isEmpty, !joinedB.isEmpty else { return false }
    let threshold = max(joinedA.count, joinedB.count) <= 8 ? 1 : 2
    return levenshtein(joinedA, joinedB) <= threshold
  }

  private static func levenshtein(_ a: String, _ b: String) -> Int {
    let a = Array(a), b = Array(b)
    var previous = Array(0...b.count)
    var current = [Int](repeating: 0, count: b.count + 1)
    for i in 1...max(a.count, 1) where a.count > 0 {
      current[0] = i
      for j in 1...b.count {
        let cost = a[i - 1] == b[j - 1] ? 0 : 1
        current[j] = Swift.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost)
      }
      previous = current
    }
    return a.isEmpty ? b.count : previous[b.count]
  }
}

// MARK: - Supporting types

private struct ContactRecord {
  let id: String
  let displayName: String
  let phones: [String]
  let emails: [String]
  let normalizedPhones: [String]
  let normalizedEmails: [String]
  let normalizedName: [String]

  init(_ contact: CNContact) {
    id = contact.identifier
    let name = [contact.givenName, contact.middleName, contact.familyName]
      .filter { !$0.isEmpty }
      .joined(separator: " ")
    displayName = name.isEmpty ? "(No name)" : name
    phones = contact.phoneNumbers.map { $0.value.stringValue }
    emails = contact.emailAddresses.map { $0.value as String }
    normalizedPhones = phones.map { ContactsDuplicatesProvider.normalizePhone($0) }
    normalizedEmails = emails.map { ContactsDuplicatesProvider.normalizeEmail($0) }
    normalizedName = ContactsDuplicatesProvider.normalizeNameTokens(name)
  }

  var summary: [String: Any] {
    ["id": id, "displayName": displayName, "phones": phones, "emails": emails]
  }
}

/// Minimal union-find with path compression — same shape as SimilarPhotos'.
private struct UnionFind {
  private var parent: [Int]

  init(count: Int) {
    parent = Array(0..<count)
  }

  mutating func find(_ x: Int) -> Int {
    if parent[x] != x {
      parent[x] = find(parent[x])
    }
    return parent[x]
  }

  mutating func union(_ a: Int, _ b: Int) {
    let rootA = find(a)
    let rootB = find(b)
    if rootA != rootB {
      parent[rootB] = rootA
    }
  }
}
