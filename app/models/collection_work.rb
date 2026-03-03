class CollectionWork < ApplicationRecord
  belongs_to :collection
  belongs_to :work

  # validates :notes, presence: true, allow_blank: true
end
