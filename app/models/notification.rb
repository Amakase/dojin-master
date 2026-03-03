class Notification < ApplicationRecord
  belongs_to :booth

  validates :source, presence: true
  validates :content, presence: true
  validates :url,
            format: {
              with: URI::DEFAULT_PARSER.make_regexp(%w[http https]),
              message: "must be an HTTP/HTTPS URL"
            }
  validates :read, inclusion: { in: [true, false] }

  def read?
    read
  end
end
