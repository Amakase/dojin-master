class CollectionWork < ApplicationRecord
  belongs_to :collection
  belongs_to :work

  # validates :notes
end
