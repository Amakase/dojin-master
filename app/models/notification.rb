class Notification < ApplicationRecord
  belongs_to :booth

  validates :source, presence: true
  validates :content, presence: true
  validates :url,
            format: {
              with: %r{^https?://(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_+.~#?&/=]*)$},
              message: "must be a URL"
            }
  validates :read, inclusion: { in: [true, false] }

  def read?
    read
  end
end
