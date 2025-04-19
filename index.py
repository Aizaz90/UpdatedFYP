from selenium import webdriver
from selenium.webdriver.firefox.service import Service
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.common.by import By
from webdriver_manager.firefox import GeckoDriverManager
from elasticsearch import Elasticsearch, helpers
import time

# ✅ Define Elasticsearch Cloud Endpoint & API Key
ES_ENDPOINT = "https://my-elasticsearch-project-a977ca.es.us-east-1.aws.elastic.cloud:443"
INDEX_NAME = "trending"

es = Elasticsearch(
    ES_ENDPOINT,
    api_key="RXUyeU5KWUJGQnJWV3pWdVVNWDY6ZkhGbjhITEtBLVA0VjNXcmd5WGRvdw=="
)

# ✅ Define multiple URLs to scrape (with pagination)
BASE_URLS = [
    "http://dreadytofatroptsdj6io7l3xptbet6onoyno2yv7jicoxknyazubrad.onion/d/hacking",
    "http://dreadytofatroptsdj6io7l3xptbet6onoyno2yv7jicoxknyazubrad.onion/d/malware",
    "http://dreadytofatroptsdj6io7l3xptbet6onoyno2yv7jicoxknyazubrad.onion/d/SocialEngineering"
]

# ✅ Configure Firefox options
options = Options()
options.headless = False  # ❌ Disable headless mode for debugging
options.set_preference("network.proxy.type", 1)
options.set_preference("network.proxy.socks", "127.0.0.1")
options.set_preference("network.proxy.socks_port", 9150)
options.set_preference("network.proxy.socks_remote_dns", True)  # ✅ Ensures .onion DNS resolution

# ✅ Automatically install GeckoDriver
service = Service(GeckoDriverManager().install())
driver = webdriver.Firefox(service=service, options=options)

def is_title_unique(title):
    """
    Checks if a title already exists in Elasticsearch.
    Returns True if the title is unique, False otherwise.
    """
    query = {
        "query": {
            "term": {
                "title.keyword": title  # Ensure exact match using keyword field
            }
        }
    }
    
    response = es.search(index=INDEX_NAME, body=query, size=1)
    return response["hits"]["total"]["value"] == 0  # ✅ Return True if no match found

try:
    for base_url in BASE_URLS:
        page_number = 1
        while True:  # Loop through all pages
            url = f"{base_url}?p={page_number}"
            print(f"\n🚀 Scraping: {url}")
            driver.get(url)

            # ✅ Handle queue (wait for redirect on first page)
            if page_number == 1:
                print("Waiting for Dread queue to finish...")
                time.sleep(20) #⏳ Adjust time if needed

            # ✅ Extract posts
            posts = driver.find_elements(By.CSS_SELECTOR, "div.postBoard div.item")

            if not posts:
                print(f"⚠️ No posts found on page {page_number}, stopping pagination.")
                break  # No more pages to scrape

            print(f"\n🔍 Found {len(posts)} posts on page {page_number} in {base_url}")

            # ✅ Store extracted posts
            page_data = []

            for post in posts:
                try:
                    # Extract title
                    title = post.find_element(By.CSS_SELECTOR, "div.postTop a.title").text.strip()

                    # ✅ Check if the title is unique before inserting
                    if not is_title_unique(title):
                        print(f"⚠️ Skipping duplicate title: {title}")
                        continue  # Skip adding this post

                    # Extract vote count
                    votes = post.find_element(By.CSS_SELECTOR, "form.voting div.voteCount").text.strip()
                    votes = int(votes) if votes.isdigit() else 0  # Convert to integer

                    # Extract author
                    author = post.find_element(By.CSS_SELECTOR, "div.postTop .author a").text.strip()

                    # Extract date
                    date = post.find_element(By.CSS_SELECTOR, "div.postTop .author span").text.strip()

                    # Extract category
                    category = post.find_element(By.CSS_SELECTOR, "div.postTop .author a[href*='/d/']").text.strip()

                    # Extract comments count
                    comments = post.find_element(By.CSS_SELECTOR, "div.postMain a[href*='/post/']").text.split()[0]
                    comments = int(comments) if comments.isdigit() else 0  # Convert to integer

                    post_data = {
                        "_index":  INDEX_NAME ,  # ✅ Your Elasticsearch index
                        "_source": {
                            "url": url,  # ✅ Store source URL for reference
                            "title": title,
                            "votes": votes,
                            "author": author,
                            "date": date,
                            "category": category,
                            "comments": comments
                        }
                    }

                    print(post_data["_source"])  # Print in console
                    page_data.append(post_data)  # Append to page list

                except Exception as e:
                    print(f"⚠️ Skipping post due to error: {e}")

            # ✅ Insert entire page into Elasticsearch
            if page_data:
                helpers.bulk(es, page_data)
                print(f"\n✅ Inserted {len(page_data)} unique posts from page {page_number} into Elasticsearch.")

            # ✅ Find the "Next" button and go to the next page
            try:
                next_button = driver.find_element(By.CSS_SELECTOR, "a.next")
                next_page_url = next_button.get_attribute("href")
                if next_page_url:
                    page_number += 1
                else:
                    print(f"✅ Reached the last page of {base_url}, stopping pagination.")
                    break
            except:
                print(f"✅ No next page found, stopping pagination for {base_url}.")
                break

finally:
    driver.quit()
